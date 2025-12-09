import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Config from '@/models/Config';

export async function GET() {
    try {
        await connectDB();
        let config = await Config.findOne();

        if (!config) {
            config = await Config.create({
                attendanceRequirement: 70, // Fallback global
                attendanceRules: {}, // Keyed by DEPT_YEAR_COURSE
                teacherAssignments: {} // Keyed by DEPT_YEAR_COURSE
            });
        }

        return NextResponse.json(config);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await connectDB();
        const body = await req.json();

        // Basic validation could be added here

        console.log('Updating config with:', JSON.stringify(body, null, 2)); // DEBUG

        const config = await Config.findOneAndUpdate({}, body, { new: true, upsert: true });
        return NextResponse.json(config);
    } catch (error: any) {
        console.error('Config update error:', error); // DEBUG
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
