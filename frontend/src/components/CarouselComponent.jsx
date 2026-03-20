import React, { useState, useEffect } from "react";
import "../../src/Carousel.css";

const CarouselComponent = ({ children }) => {
  const [counter, setCounter] = useState(1);
  const [pause, setPause] = useState(false);
  const content = children;

  const handleNext = () => {
    if (counter !== content.length) {
      setCounter(counter + 1);
    } else {
      setCounter(1);
    }
  };

  const handlePre = () => {
    if (counter !== 1) {
      setCounter(counter - 1);
    } else {
      setCounter(content.length);
    }
  };

  const handlePage = (page) => {
    setCounter(page);
  };

  const handleMouse = () => {
    setPause(!pause);
  };

  useEffect(() => {
    let interval = setInterval(() => {
      if (!pause) {
        handleNext();
      } else {
        clearInterval(interval);
      }
    }, 3500);
    return () => clearInterval(interval);
  });

  return (
    <div className="App-cr">
      <div
        className="slide-cr"
        onMouseEnter={handleMouse}
        onMouseLeave={handleMouse}
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
