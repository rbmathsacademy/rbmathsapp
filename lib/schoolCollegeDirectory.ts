import SchoolCollegeEntry from '@/models/SchoolCollegeEntry';

/**
 * Registers a school/college name into the permanent directory, if it's new.
 * Call this whenever a student is created/edited with a non-empty name — it's
 * how a custom-typed entry becomes available in future dropdowns. Never removes
 * entries, so the directory survives student deletion.
 */
export async function registerDirectoryEntry(type: 'school' | 'college', name?: string | null): Promise<void> {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    try {
        await SchoolCollegeEntry.updateOne(
            { type, nameLower: trimmed.toLowerCase() },
            { $setOnInsert: { name: trimmed, type, nameLower: trimmed.toLowerCase() } },
            { upsert: true }
        );
    } catch (error) {
        // Non-critical: never let a directory write failure block the student save.
        console.error('Failed to register school/college directory entry:', error);
    }
}
