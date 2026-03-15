import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/db';
import ChatMessage from '@/models/ChatMessage';
import ChatBatchMetadata from '@/models/ChatBatchMetadata';
import BatchStudent from '@/models/BatchStudent';
import User from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

async function getPayload(req: NextRequest) {
    let token = req.cookies.get('auth_token')?.value;
    if (!token) {
        const authHeader = req.headers.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, key);
        return payload;
    } catch (e) {
        console.error('[Chat Messages] JWT verify error:', e);
        return null;
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const batchId = searchParams.get('batchId');

        if (!batchId) {
            return NextResponse.json({ error: 'Batch ID is required' }, { status: 400 });
        }

        const payload = await getPayload(req);
        if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const adminRoles = ['admin', 'superadmin', 'manager', 'copy_checker'];
        const isAdmin = adminRoles.includes(payload.role as string);
        const myPhoneNumber = (payload.phoneNumber || payload.userId) as string;
        
        await dbConnect();

        // Fetch messages for the batch
        const rawMessages = await ChatMessage.find({ batchId })
            .sort({ createdAt: 1 })
            .lean();

        // Map messages to handle anonymity
        const messages = rawMessages.map((msg: any) => {
            if (isAdmin) return msg; // Admins see everything (real names)

            // Students see:
            // 1. "Me" label for their own messages (handled client-side via senderId)
            // 2. "Admin" for admin messages
            // 3. "Anonymous" for other students' messages
            if (msg.senderRole === 'admin') {
                return { ...msg, senderName: 'Admin' };
            }
            if (msg.senderId === myPhoneNumber) {
                return msg; // Keep their own name
            }
            return { ...msg, senderName: 'Anonymous' };
        });

        // Update read status
        if (isAdmin) {
            await ChatBatchMetadata.findOneAndUpdate(
                { batchId },
                { lastAdminReadAt: new Date() },
                { upsert: true }
            );
        } else {
            // Update student's individual read status
            await BatchStudent.findOneAndUpdate(
                { phoneNumber: myPhoneNumber },
                { [`chatReadStatus.${batchId}`]: new Date() }
            );
        }

        return NextResponse.json({ messages });
    } catch (error: any) {
        console.error('Chat GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { batchId, content, type = 'text', replyTo } = body;

        if (!batchId || !content) {
            return NextResponse.json({ error: 'Missing batchId or content' }, { status: 400 });
        }

        const payload = await getPayload(req);
        if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        await dbConnect();

        let senderName = '';
        let senderRole = 'student';
        let senderId = '';

        const adminRoles = ['admin', 'superadmin', 'manager', 'copy_checker'];

        if (adminRoles.includes(payload.role as string)) {
            const admin = await User.findById(payload.userId);
            senderName = admin?.name || 'Admin';
            senderRole = 'admin';
            senderId = 'admin';
        } else {
            const phoneNumber = (payload.phoneNumber || payload.userId) as string;
            const student = await BatchStudent.findOne({ phoneNumber });
            senderName = student?.name || 'Student';
            senderRole = 'student';
            senderId = phoneNumber;
        }

        const messageData: any = {
            batchId,
            senderId,
            senderName,
            senderRole,
            content,
            type
        };

        if (replyTo && replyTo.messageId) {
            messageData.replyTo = {
                messageId: replyTo.messageId,
                senderName: replyTo.senderName,
                content: replyTo.content?.substring(0, 200),
                senderRole: replyTo.senderRole
            };
        }

        const newMessage = await ChatMessage.create(messageData);

        // Update metadata
        await ChatBatchMetadata.findOneAndUpdate(
            { batchId },
            { 
                lastMessageAt: new Date(),
                ...(senderRole === 'admin' ? { lastAdminReadAt: new Date() } : {})
             },
            { upsert: true }
        );

        if (senderRole === 'student') {
            sendAdminNotification(senderName, batchId, content);
        }

        return NextResponse.json({ success: true, message: newMessage });
    } catch (error: any) {
        console.error('Chat POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { messageId, content } = body;

        if (!messageId || !content) {
            return NextResponse.json({ error: 'Missing messageId or content' }, { status: 400 });
        }

        const payload = await getPayload(req);
        if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        await dbConnect();

        const message = await ChatMessage.findById(messageId);
        if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

        // Authorization check
        const adminRoles = ['admin', 'superadmin', 'manager', 'copy_checker'];
        const isAdmin = adminRoles.includes(payload.role as string);
        const myPhoneNumber = (payload.phoneNumber || payload.userId) as string;

        // Admin can edit admin messages, students can edit their own
        if (isAdmin && message.senderRole !== 'admin') {
            return NextResponse.json({ error: 'Admin can only edit admin messages' }, { status: 403 });
        }
        if (!isAdmin && message.senderId !== myPhoneNumber) {
            return NextResponse.json({ error: 'You can only edit your own messages' }, { status: 403 });
        }

        // Save original content for the first edit
        if (!message.isEdited) {
            message.originalContent = message.content;
            message.isEdited = true;
        }
        message.content = content;
        await message.save();

        return NextResponse.json({ success: true, message });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const messageId = searchParams.get('messageId');

        if (!messageId) {
            return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });
        }

        const payload = await getPayload(req);
        if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        await dbConnect();

        const message = await ChatMessage.findById(messageId);
        if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

        // Authorization check - only own messages
        const adminRoles = ['admin', 'superadmin', 'manager', 'copy_checker'];
        const isAdmin = adminRoles.includes(payload.role as string);
        const myPhoneNumber = (payload.phoneNumber || payload.userId) as string;

        if (isAdmin && message.senderRole !== 'admin') {
            return NextResponse.json({ error: 'Admin can only delete admin messages' }, { status: 403 });
        }
        if (!isAdmin && message.senderId !== myPhoneNumber) {
            return NextResponse.json({ error: 'You can only delete your own messages' }, { status: 403 });
        }

        await ChatMessage.findByIdAndDelete(messageId);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Chat DELETE error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function sendAdminNotification(studentName: string, batchId: string, content: string) {
    const adminEmail = 'rb.mathsacademy@gmail.com';
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    console.log(`
--- NEW CHAT NOTIFICATION ---
To: ${adminEmail}
Subject: New Doubt in ${batchId}
Body:
Hello Admin,
Student ${studentName} has posted a new message in the ${batchId} chat at ${timestamp}.

Content: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}

Please check the Admin Portal to respond.
-----------------------------
    `);
}
