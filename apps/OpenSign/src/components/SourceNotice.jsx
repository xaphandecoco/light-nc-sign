import { useEffect, useState } from "react";

// AGPL-3.0 section 13: every page links to the exact source of the running release.
// The release tag is written to /version.txt when the image is built.
export const SOURCE_REPO = "https://github.com/xaphandecoco/light-nc-sign";

export const useSourceUrl = () => {
  const [tag, setTag] = useState("");
  useEffect(() => {
    fetch("/version.txt")
      .then((res) => (res.ok ? res.text() : ""))
      .then((text) => setTag(/^[\w.-]+$/.test(text.trim()) ? text.trim() : ""))
      .catch(() => setTag(""));
  }, []);
  return tag ? `${SOURCE_REPO}/tree/${tag}` : SOURCE_REPO;
};

const SourceNotice = () => {
  const sourceUrl = useSourceUrl();
  return (
    <div className="fixed bottom-0 left-0 z-[5] max-w-full px-2 py-[2px] text-[11px] leading-tight bg-base-100/80 text-base-content rounded-tr">
      Light NC Sign is based on OpenSign, licensed AGPL-3.0.{" "}
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        Source code
      </a>
    </div>
  );
};

export default SourceNotice;
