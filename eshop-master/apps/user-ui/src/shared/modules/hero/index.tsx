"use client";
import useLayout from "apps/user-ui/src/hooks/useLayout";
import { MoveRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React from "react";

const Hero = () => {
  const router = useRouter();
  const { layout } = useLayout();

  return (
    <div className="bg-[#115061] h-[85vh] flex flex-col justify-center w-full">
      <div className="md:w-[80%] w-[90%] m-auto md:flex h-full items-center">
        <div className="md:w-1/2">
          <p className="font-Roboto font-normal text-white pb-2 text-xl">
            Starting from 40$
          </p>
          <h1 className="text-white text-6xl font-extrabold font-Roboto">
            The best watch <br />
            Collection 2025
          </h1>
          <p className="font-Oregano text-3xl pt-4 text-white">
            Exclusive offer <span className="text-yellow-400">10%</span> off
            this week
          </p>
          <br />
          <button
            onClick={() => router.push("/products")}
            className="w-[140px] gap-2 font-semibold h-[40px] hover:text-white transition bg-white hover:bg-transparent hover:border hover:border-gray-200 flex items-center justify-center !rounded"
          >
            Shop Now <MoveRight />
          </button>
        </div>
        <div className="md:w-1/2 flex justify-center">
          <Image
            src={
              layout?.banner ||
              "https://ik.imagekit.io/fz0xzwtey/products/slider-img-1.png?updatedAt=1744358118885"
            }
            alt=""
            width={450}
            height={450}
          />
        </div>
      </div>
    </div>
  );
};

export default Hero;
