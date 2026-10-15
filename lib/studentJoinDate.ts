// Older BatchStudent documents predate the `createdAt` timestamp field, so fall
// back to the join date embedded in the Mongo ObjectId itself (its first 4 bytes
// are a Unix timestamp) rather than treating them as having no join date at all.
export function resolveStudentJoinedAt(student: { createdAt?: Date | string; _id: any }): Date {
    if (student.createdAt) return new Date(student.createdAt);
    return new Date(parseInt(student._id.toString().slice(0, 8), 16) * 1000);
}
