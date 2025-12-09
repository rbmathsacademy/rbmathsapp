import AssignmentDetailClient from './AssignmentDetailClient';

export default async function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    return <AssignmentDetailClient assignmentId={id} />;
}
