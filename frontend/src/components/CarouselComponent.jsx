import React, { useState, useEffect, useMemo, useCallback } from "react";
import "../../src/Carousel.css";

const CarouselComponent = ({ children, intervalTime = 3500 }) => {
  const [counter, setCounter] = useState(1);
  const [pause, setPause] = useState(false);

  // ✅ Memoized children array
  const content = useMemo(() => {
    return React.Children.toArray(children);
  }, [children]);

  // ✅ Stable next handler
  const handleNext = useCallback(() => {
    setCounter((prev) => (prev !== content.length ? prev + 1 : 1));
  }, [content.length]);

  const handlePre = useCallback(() => {
    setCounter((prev) => (prev !== 1 ? prev - 1 : content.length));
  }, [content.length]);

  const handlePage = (page) => {
    setCounter(page);
  };

  const handleMouseEnter = () => setPause(true);
  const handleMouseLeave = () => setPause(false);

  // ✅ Dynamic interval per slide
  useEffect(() => {
    if (pause || content.length === 0) return;

    const currentItem = content[counter - 1];

    const customInterval =
      currentItem?.props?.["data-interval"] || intervalTime;

    const interval = setInterval(() => {
      handleNext();
    }, customInterval);

    return () => clearInterval(interval);
  }, [pause, counter, intervalTime, content, handleNext]);

  return (
    <div className="App-cr">
      <div
        className="slide-cr"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {content.map((item, index) => (
          <div
            className={counter - 1 === index ? "show-cr" : "not-show-cr"}
            key={index}
          >
            {item}
          </div>
        ))}

        <button className="prev-cr button-cr" onClick={handlePre}>
          &#10094;
        </button>
        <button className="next-cr button-cr" onClick={handleNext}>
          &#10095;
        </button>
      </div>

      <div className="page-cr">
        {content.map((item, index) => (
          <span
            key={index}
            className={counter - 1 === index ? "dot-cr active" : "dot-cr"}
            onClick={() => handlePage(index + 1)}
          />
        ))}
      </div>
    </div>
  );
};

export default CarouselComponent;
