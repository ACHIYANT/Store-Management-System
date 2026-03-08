import Lottie from "lottie-react";
import notFoundAnimation from "../assets/404.json";

export default function PageNotFound() {
  return (
    <main className="h-full min-h-0 w-full bg-slate-50/40 overflow-hidden">
      <div className="h-full w-full flex items-center justify-center px-3 sm:px-4">
        <div className="w-full max-w-5xl text-center">
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">
            Page Not Found
          </h1>
          <p className="mt-1 text-sm sm:text-base text-slate-600">
            The page you are looking for does not exist or has been moved.
          </p>
          <Lottie
            animationData={notFoundAnimation}
            loop={true}
            autoplay={true}
            className="mt-3 w-full h-[58vh] min-h-[260px] max-h-[700px]"
          />
        </div>
      </div>
    </main>
  );
}
