// Shown instantly while this page loads, so the tap that opened it never feels dead
export default function Loading() {
    return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 bg-[#0b0718] text-violet-200/70">
            <div className="h-10 w-10 rounded-full border-2 border-fuchsia-400/30 border-t-fuchsia-400 animate-spin" />
            <p className="text-sm font-medium">Opening your test...</p>
        </div>
    );
}
