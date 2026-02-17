"use client";

import React from "react";
import Link from "next/link";
import {
  Facebook,
  Twitter,
  Linkedin,
  Mail,
  MapPin,
  ArrowUp,
} from "lucide-react";
import { usePathname } from "next/navigation";

const Footer = () => {
  const pathname = usePathname();

  if (pathname === "/inbox") return null;
  return (
    <footer className="bg-[#F4F7F9] border-t border-t-slate-200 py-10 text-gray-700">
      <div className="w-[90%] lg:w-[80%] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
        {/* About Company */}
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"></h2>
          <p className="text-sm mt-3">
            Perfect ecommerce platform to start your business from scratch
          </p>

          {/* Social Icons */}
          <div className="flex gap-3 mt-4">
            <Link href="#" className="p-2 bg-white shadow rounded">
              <Facebook size={18} />
            </Link>
            <Link href="#" className="p-2 bg-white shadow rounded">
              <Twitter size={18} />
            </Link>
            <Link href="#" className="p-2 bg-white shadow rounded">
              <Linkedin size={18} />
            </Link>
          </div>
        </div>

        {/* My Account */}
        <div>
          <h4 className="text-lg font-semibold">My Account</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/track-orders" className="hover:underline">
                Track Orders
              </Link>
            </li>
            <li>
              <Link href="/shipping" className="hover:underline">
                Shipping
              </Link>
            </li>
            <li>
              <Link href="/wishlist" className="hover:underline">
                Wishlist
              </Link>
            </li>
            <li>
              <Link href="/account" className="hover:underline">
                My Account
              </Link>
            </li>
            <li>
              <Link href="/order-history" className="hover:underline">
                Order History
              </Link>
            </li>
            <li>
              <Link href="/returns" className="hover:underline">
                Returns
              </Link>
            </li>
          </ul>
        </div>

        {/* Information */}
        <div>
          <h4 className="text-lg font-semibold">Information</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/about" className="hover:underline">
                Our Story
              </Link>
            </li>
            <li>
              <Link href="/careers" className="hover:underline">
                Careers
              </Link>
            </li>
            <li>
              <Link href="/privacy-policy" className="hover:underline">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:underline">
                Terms & Conditions
              </Link>
            </li>
            <li>
              <Link href="/news" className="hover:underline">
                Latest News
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:underline">
                Contact Us
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact Info */}
        <div>
          <h4 className="text-lg font-semibold">Talk To Us</h4>
          <p className="text-sm mt-2">Got Questions? Call us</p>
          <p className="text-xl font-bold text-black mt-1">+670 413 90 762</p>

          <div className="mt-3 flex items-center gap-2">
            <Mail size={16} />
            <span className="text-sm">support@eshop.com</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <MapPin size={16} />
            <span className="text-sm">
              79 Sleepy Hollow St. <br />
              Jamaica, New York 1432
            </span>
          </div>
        </div>
      </div>

      {/* Footer Bottom */}
      <div className="w-[90%] lg:w-[80%] mx-auto border-t border-gray-200 mt-10 pt-4 flex flex-col lg:flex-row items-center justify-between">
        <p className="text-sm">
          © 2025 All Rights Reserved | Becodemy Private Ltd
        </p>

        {/* Back to Top Button */}
        <button
          className="bg-black text-white cursor-pointer p-3 rounded-full shadow-lg hover:bg-gray-800 transition"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <ArrowUp size={20} />
        </button>
      </div>
    </footer>
  );
};

export default Footer;
