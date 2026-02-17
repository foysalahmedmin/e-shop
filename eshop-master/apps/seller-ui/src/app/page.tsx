"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  Star,
  MapPin,
  Users,
  Heart,
  Pencil,
  Clock,
  Calendar,
  Globe,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "apps/seller-ui/src/utils/axiosInstance";
import useSeller from "apps/seller-ui/src/hooks/useSeller";
import YoutubeIcon from "apps/seller-ui/src/assets/icons/youtube-icons";
import ProductCard from "../shared/components/cards/product.card";
import ImageEditModal from "../shared/components/modals/image-edit-modal";
import XIcon from "../assets/icons/xIcon";

const TABS = ["Products", "Offers", "Reviews"];

const fetchProducts = async () => {
  const res = await axiosInstance.get("/product/api/get-shop-products");
  const products = res.data.products?.filter((i: any) => !i.starting_date);
  return products;
};

const fetchEvents = async () => {
  const res = await axiosInstance.get("/product/api/get-shop-products");
  const products = res.data.products?.filter((i: any) => i.starting_date);
  return products;
};

const SellerProfile = () => {
  const { seller, isLoading } = useSeller();
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState("Products");
  const [editType, setEditType] = useState<"cover" | "avatar" | null>(null); // Store type of image editing
  const router = useRouter();

  const { data: products = [] } = useQuery({
    queryKey: ["shop-products"],
    queryFn: fetchProducts,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!seller && !isLoading) {
      router.push("/login");
    }
  }, [seller, isLoading]);

  const { data: events = [] } = useQuery({
    queryKey: ["shop-events"],
    queryFn: fetchEvents,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <>
      {isLoading ? (
        <div></div>
      ) : (
        <div className="w-full bg-gray-900 min-h-screen">
          {/* Back to Dashboard Button */}
          <div className="w-full px-3 pt-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 text-gray-300 hover:text-white transition mb-4"
            >
              <ArrowLeft size={20} />
              <span className="font-medium">Back to Dashboard</span>
            </button>
          </div>

          {/* Cover Photo */}
          <div className="relative w-full flex justify-center bg-gray-800">
            <Image
              src={
                seller?.shop?.coverBanner ||
                "https://ik.imagekit.io/fz0xzwtey/cover/1200%20x%20300.svg?updatedAt=1742072797684"
              }
              alt="Seller Cover"
              className="w-full h-[400px] object-cover"
              width={1200}
              height={300}
            />
            {seller?.id && (
              <button
                className="absolute top-3 right-3 bg-gray-700 px-3 py-2 rounded-md flex items-center gap-2 text-white hover:bg-gray-600 transition"
                onClick={() => setEditType("cover")}
              >
                <Pencil size={16} /> Edit Cover
              </button>
            )}
          </div>

          {/* Seller Info Section */}
          <div className="w-[85%] lg:w-[70%] mt-[-50px] mx-auto relative z-20 flex flex-col lg:flex-row gap-6">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex-1">
              <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                <div className="relative w-[100px] h-[100px] rounded-full border-4 border-gray-700 overflow-hidden">
                  <Image
                    src={
                      seller?.shop?.avatar ||
                      "https://ik.imagekit.io/fz0xzwtey/avatar/amazon.jpeg"
                    }
                    alt="Seller Avatar"
                    layout="fill"
                    objectFit="cover"
                  />
                  {seller?.id && (
                    <label
                      className="absolute bottom-1 right-1 bg-gray-700 p-2 rounded-full cursor-pointer"
                      onClick={() => setEditType("avatar")}
                    >
                      <Pencil size={16} className="text-white" />
                    </label>
                  )}
                </div>

                <div className="flex-1 w-full">
                  <h1 className="text-2xl font-semibold text-white">
                    {seller?.shop?.name}
                  </h1>
                  <p className="text-gray-400 text-sm mt-1">
                    {seller?.shop?.bio || "No bio available."}
                  </p>

                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center text-yellow-400 gap-1">
                      <Star fill="#facc15" size={18} />{" "}
                      <span>{seller?.shop?.ratings || "N/A"}</span>
                    </div>
                    <div className="flex items-center text-gray-300 gap-1">
                      <Users size={18} />{" "}
                      <span>{seller?.followers || 0} Followers</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-3 text-gray-400">
                    <Clock size={18} />
                    <span>
                      {seller?.shop?.opening_hours || "Mon - Sat: 9 AM - 6 PM"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-3 text-gray-400">
                    <MapPin size={18} />{" "}
                    <span>
                      {seller?.shop?.address || "No address provided"}
                    </span>
                  </div>
                </div>

                {seller?.id ? (
                  <button
                    className="px-6 py-2 h-[40px] rounded-lg font-semibold flex items-center gap-2 bg-gray-700 text-white transition"
                    onClick={() => router.push("/edit-profile")}
                  >
                    <Pencil size={18} />
                    Edit Profile
                  </button>
                ) : (
                  <button
                    className={`px-6 py-2 h-[40px] rounded-lg font-semibold flex items-center gap-2 ${
                      isFollowing
                        ? "bg-gray-700 text-white"
                        : "bg-blue-600 text-white"
                    } transition`}
                    onClick={() => setIsFollowing(!isFollowing)}
                  >
                    <Heart size={18} />
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                )}
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full lg:w-[30%]">
              <h2 className="text-xl font-semibold text-white">Shop Details</h2>

              <div className="flex items-center gap-3 mt-3 text-gray-400">
                <Calendar size={18} />
                <span>
                  Joined At:{" "}
                  {new Date(seller?.shop?.createdAt).toLocaleDateString()}
                </span>
              </div>

              {seller?.shop?.website && (
                <div className="flex items-center gap-3 mt-3 text-gray-400">
                  <Globe size={18} />
                  <Link
                    href={seller?.shop?.website}
                    className="hover:underline text-blue-400"
                  >
                    {seller?.shop?.website}
                  </Link>
                </div>
              )}

              {seller?.shop?.socialLinks &&
                seller?.shop?.socialLinks.length > 0 && (
                  <div className="mt-3">
                    <h3 className="text-white text-lg font-medium">
                      Follow Us:
                    </h3>
                    <div className="flex gap-3 mt-2">
                      {seller?.shop?.socialLinks?.map(
                        (link: any, index: number) => (
                          <a
                            key={index}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opacity-[.9]"
                          >
                            {link.type === "youtube" && <YoutubeIcon />}
                            {link.type === "x" && <XIcon />}
                          </a>
                        )
                      )}
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* Tabs Section */}
          <div className="w-[85%] lg:w-[70%] mx-auto mt-8">
            {/* Tabs */}
            <div className="flex border-b border-gray-600">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-3 px-6 text-lg font-semibold ${
                    activeTab === tab
                      ? "text-white border-b-2 border-blue-500"
                      : "text-gray-400"
                  } transition`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="bg-gray-800 p-3 rounded-lg my-6 text-white">
              {activeTab === "Products" && (
                <div className="m-auto grid grid-cols-1 md:grid-cols-3 gap-5">
                  {products?.map((product: any) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                  {products?.length === 0 && <p>No products available yet!</p>}
                </div>
              )}
              {activeTab === "Offers" && (
                <div className="m-auto grid grid-cols-1 md:grid-cols-3 gap-5">
                  {events?.map((product: any) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                  {events?.length === 0 && <p>No offers available yet!</p>}
                </div>
              )}
              {activeTab === "Reviews" && <div>No reviews available yet!</div>}
            </div>
          </div>

          {editType && (
            <ImageEditModal
              editType={editType}
              onClose={() => setEditType(null)}
            />
          )}
        </div>
      )}
    </>
  );
};

export default SellerProfile;
