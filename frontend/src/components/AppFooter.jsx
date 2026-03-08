export default function AppFooter() {
  return (
    <footer className="shrink-0 border-t border-slate-200/70 bg-white/80 backdrop-blur-md print:hidden">
      <div className="mx-auto flex w-full max-w-[2400px] items-center justify-center px-3 py-2.5 sm:px-4">
        <p className="text-xs text-slate-600 sm:text-sm">
          Made with <span className="text-rose-500">♥️</span> by{" "}
          <span className="font-semibold tracking-wide text-slate-800">
            Achiyant
          </span>
        </p>
      </div>
    </footer>
  );
}
