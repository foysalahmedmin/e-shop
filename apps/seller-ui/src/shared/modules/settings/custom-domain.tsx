"use client";

import React from "react";
import {
  Globe,
  PlusCircle,
  Save,
  CheckCircle,
  XCircle,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import Input from "packages/components/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import axiosInstance from "apps/seller-ui/src/utils/axiosInstance";

// Fetch seller's connected domain
const fetchDomains = async () => {
  const res = await axiosInstance.get("/product/api/get-seller-domain");
  return res?.data?.domains || [];
};

const CustomDomains = () => {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: { domainName: "" },
  });

  // Fetch domains
  const { data: domains = [], isLoading } = useQuery({
    queryKey: ["seller-domain"],
    queryFn: fetchDomains,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // **Mutation to add domain**
  const addDomainMutation = useMutation({
    mutationFn: async (data: any) => {
      if (domains.length > 0) {
        throw new Error("You can only add one custom domain per shop.");
      }
      const res = await axiosInstance.post("/product/api/add-seller-domain", {
        domain: data.domainName,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-domain"] });
      reset();
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || "Failed to add domain.");
    },
  });

  // **Mutation to remove domain**
  const removeDomainMutation = useMutation({
    mutationFn: async (id: string) => {
      await axiosInstance.delete(`/product/api/domains/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-domain"] });
    },
    onError: () => {
      toast.error("Failed to remove domain.");
    },
  });

  // **Mutation to verify domain**
  const verifyDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      const res = await axiosInstance.put("/product/api/verify-seller-domain", {
        domain,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-domain"] });
    },
    onError: () => {
      alert("Domain verification failed! Check your DNS settings.");
    },
  });

  return (
    <div className="max-w-2xl space-y-6">
      {domains.length === 0 && (
        <div className="px-4 rounded-lg">
          <div className="flex items-center gap-3">
            <PlusCircle size={22} className="text-blue-400" />
            <div>
              <h3 className="text-white font-semibold">Add Custom Domain</h3>
              <p className="text-gray-400 text-sm">
                Connect your own domain to this store.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit((data) => addDomainMutation.mutate(data))}
            className="mt-4 border-t border-gray-700 pt-4"
          >
            <Input
              label="Domain Name"
              placeholder="yourdomain.com"
              {...register("domainName", { required: "Domain is required" })}
            />
            {errors.domainName && (
              <p className="text-red-500 text-xs mt-1">
                {errors.domainName.message}
              </p>
            )}
            <button
              type="submit"
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
              disabled={addDomainMutation.isPending}
            >
              {addDomainMutation.isPending ? (
                "Processing..."
              ) : (
                <>
                  <Save size={18} /> Save Domain
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Connected Domains */}
      <div className="px-4 rounded-lg">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Globe size={22} className="text-green-400" /> Connected Domain
        </h3>
        <p className="text-gray-400 text-sm mt-1 mb-3">
          Manage your custom domain.
        </p>

        <div className="mt-4 space-y-4">
          {isLoading ? (
            <p className="text-gray-400">Loading...</p>
          ) : domains.length === 0 ? (
            <p className="text-gray-400">No domain connected yet.</p>
          ) : (
            domains.map((domain: any) => (
              <div
                key={domain.id}
                className="flex justify-between items-center p-3 border border-gray-700 rounded-md"
              >
                <div className="flex items-center gap-3">
                  {domain.status === "VERIFIED" ? (
                    <CheckCircle size={22} className="text-green-400" />
                  ) : (
                    <XCircle size={22} className="text-yellow-400" />
                  )}
                  <div>
                    <p className="text-white font-semibold">{domain.domain}</p>
                    <p
                      className={`text-sm ${
                        domain.status === "VERIFIED"
                          ? "text-green-400"
                          : "text-yellow-400"
                      }`}
                    >
                      {domain.status}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {domain.status !== "Verified" && (
                    <button
                      onClick={() => verifyDomainMutation.mutate(domain.domain)}
                      className="text-blue-400 hover:text-blue-300 transition"
                    >
                      <RefreshCcw size={20} />
                    </button>
                  )}
                  <button
                    onClick={() => removeDomainMutation.mutate(domain.id)}
                    className="text-red-400 hover:text-red-300 transition"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {verifyDomainMutation.isError && (
          <p className="text-red-500 text-sm mt-3">
            Error verifying domain! Please check your DNS settings and try
            again.
          </p>
        )}
      </div>

      {/* DNS Configuration */}
      <div className="px-4 rounded-lg">
        <div className="flex items-center gap-3">
          <Globe size={22} className="text-yellow-400" />
          <div>
            <h3 className="text-white font-semibold">DNS Configuration</h3>
            <p className="text-gray-400 text-sm">
              Set up your DNS records for verification.
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-gray-700 pt-4 text-gray-300">
          <p>To verify your domain, add the following DNS records:</p>
          <ul className="mt-2 space-y-2 text-sm">
            <li>
              <strong>CNAME:</strong> Set{" "}
              <span className="text-green-400">www</span> to point to{" "}
              <span className="text-blue-400">seller.shondhane.com</span>
            </li>
            <li>
              <strong>A Record:</strong> Point your root domain to{" "}
              <span className="text-blue-400">YOUR_SERVER_IP</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CustomDomains;
