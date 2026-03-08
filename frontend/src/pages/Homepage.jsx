import CarouselComponent from "../components/CarouselComponent";
import React from "react";
import carousel1 from "/carousel-1_light.png";
import carousel2 from "/carousel-2_light.png";
import carousel3 from "/carousel-3_light.png";
import carousel4 from "/carousel-4_light.png";
import carousel5 from "/carousel-5_light.png";

import HomeDashboardCharts from "@/components/HomeDashboardCharts";

export default function Homepage() {
  return (
    <div className="flex min-h-screen">
      {/* <Sidebar /> */}
      <div className="flex-1 flex flex-col">
        {/* <Navbar /> */}
        <div className="p-4">
          <CarouselComponent>
            <div>
              <img className="img-cr" src={carousel1} alt="img1" />
            </div>
            <div>
              <img className="img-cr" src={carousel2} alt="img2" />
            </div>
            <div>
              <img className="img-cr" src={carousel3} alt="img3" />
            </div>
            <div>
              <img className="img-cr" src={carousel4} alt="img4" />
            </div>
            <div>
              <img className="img-cr" src={carousel5} alt="img5" />
            </div>
          </CarouselComponent>
          <HomeDashboardCharts />
        </div>
      </div>
    </div>
  );
}
