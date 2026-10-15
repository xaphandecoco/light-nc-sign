import Loader from "./Loader";

// The upstream sending animation was loaded from lottie.host; we show our own spinner instead
// so the page makes no outside request.
const LottieWithLoader = () => (
  <div className="w-[120px] h-[120px] mx-auto">
    <Loader />
  </div>
);

export default LottieWithLoader;
