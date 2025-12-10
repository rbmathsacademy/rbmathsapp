import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Resource from '@/models/Resource';

const GLOBAL_ADMIN_KEY = 'globaladmin_25';

export async function GET(req: Request) {
    await connectDB();
    const email = req.headers.get('X-User-Email');
    const adminKey = req.headers.get('X-Global-Admin-Key');

    if (adminKey === GLOBAL_ADMIN_KEY) {
        try {
            const resources = await Resource.find({}).sort({ createdAt: -1 });
            return NextResponse.json(resources);
        } catch (error: any) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

    if (!email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const resources = await Resource.find({ uploadedBy: email }).sort({ createdAt: -1 });
        return NextResponse.json(resources);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await connectDB();
        const data = await req.json();
        const email = req.headers.get('X-User-Email');
        const adminKey = req.headers.get('X-Global-Admin-Key');

        if (!email && adminKey !== GLOBAL_ADMIN_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const uploader = (adminKey === GLOBAL_ADMIN_KEY && !email) ? 'Global Admin' : email;

        const resource = await Resource.create({ ...data, uploadedBy: uploader });
        return NextResponse.json(resource);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const email = req.headers.get('X-User-Email');
        const adminKey = req.headers.get('X-Global-Admin-Key');

        if (!email && adminKey !== GLOBAL_ADMIN_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let resource;
        if (adminKey === GLOBAL_ADMIN_KEY) {
            resource = await Resource.findById(id);
        } else {
            resource = await Resource.findOne({ _id: id, uploadedBy: email });
        }

        if (!resource) {
            return NextResponse.json({ error: 'Resource not found or unauthorized' }, { status: 404 });
        }

        await Resource.findByIdAndDelete(id);
        return NextResponse.json({ message: 'Deleted' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
