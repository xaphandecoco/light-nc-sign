import React, { useEffect, useState } from "react";
import { openInNewTab } from "../constant/Utils";
import { useSourceUrl } from "./SourceNotice";
import { useTranslation } from "react-i18next";
const Footer = () => {
  const appName = "Light NC Sign";
  const { t } = useTranslation();
  const [showButton, setShowButton] = useState(false);
  const sourceUrl = useSourceUrl();
  const version = sourceUrl.split("/tree/")[1] || "";

  const handleScroll = () => {
    if (window.pageYOffset >= 50) {
      setShowButton(true);
    } else {
      setShowButton(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo(0, 0);
    setShowButton(false);
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const openUrl = () => {
    openInNewTab(sourceUrl);
  };
  return (
    <>
      <footer className="op-footer op-footer-center py-3 bg-base-300 text-base-content text-center text-[13px]">
        <aside>
          <p>
            {t("all-right")} &copy; {new Date().getFullYear()} &nbsp;
            <span onClick={openUrl} className="hover:underline cursor-pointer">
              {appName} ( {t("version")}:{" "}
              {version})
            </span>
          </p>
        </aside>
      </footer>
      <button
        className={`${
          showButton ? "block" : "hidden"
        } fixed bottom-4 right-4 px-3 p-2 text-xl op-bg-secondary text-white rounded focus:outline-none`}
        onClick={scrollToTop}
      >
        <i className="fa-light fa-angle-up"></i>
      </button>
    </>
  );
};

export default Footer;
