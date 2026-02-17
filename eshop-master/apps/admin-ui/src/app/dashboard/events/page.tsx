"use client";

import BreadCrumbs from "apps/admin-ui/src/shared/components/breadcrumbs";
import React, { useMemo, useState, useDeferredValue } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from "@tanstack/react-table";
import { Search, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { saveAs } from "file-saver";
import Image from "next/image";
import Link from "next/link";
import axiosInstance from "apps/admin-ui/src/utils/axiosInstance";

const EventsPage = () => {
  const [globalFilter, setGlobalFilter] = useState("");
  const [page, setPage] = useState(1);
  const deferredGlobalFilter = useDeferredValue(globalFilter);
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ["events-list", page],
    queryFn: async () => {
      const res = await axiosInstance.get(
        `/admin/api/get-all-events?page=${page}&limit=${limit}`
      );
      return res.data;
    },
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 5,
  });

  const allEvents = data?.data || [];
  const totalPages = Math.ceil((data?.meta?.totalEvents ?? 0) / limit);

  const filteredEvents = useMemo(() => {
    return allEvents.filter((event: any) => {
      const values = Object.values(event).join(" ").toLowerCase();
      return values.includes(deferredGlobalFilter.toLowerCase());
    });
  }, [allEvents, deferredGlobalFilter]);

  const columns = useMemo(
    () => [
      {
        accessorKey: "images",
        header: "Image",
        cell: ({ row }: any) => (
          <Image
            src={row.original.images[0]?.url || "/placeholder.png"}
            alt={row.original.title}
            width={40}
            height={40}
            className="w-10 h-10 rounded object-cover"
          />
        ),
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }: any) => (
          <Link
            href={`${process.env.NEXT_PUBLIC_USER_UI_LINK}/product/${row.original.slug}`}
            className="hover:text-blue-500 hover:border-b"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: "sale_price",
        header: "Price",
        cell: ({ row }) => `$${row.original.sale_price}`,
      },
      {
        accessorKey: "stock",
        header: "Stock",
      },
      {
        accessorKey: "starting_date",
        header: "Start",
        cell: ({ row }) =>
          new Date(row.original.starting_date).toLocaleDateString(),
      },
      {
        accessorKey: "ending_date",
        header: "End",
        cell: ({ row }) =>
          new Date(row.original.ending_date).toLocaleDateString(),
      },
      {
        accessorKey: "Shop.name",
        header: "Shop Name",
        cell: ({ row }) => row.original.Shop?.name || "-",
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredEvents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
  });

  const exportToCSV = () => {
    const csvData = filteredEvents.map(
      (event: any) =>
        `${event.title},${event.sale_price},${event.stock},${event.starting_date},${event.ending_date},${event.Shop?.name}`
    );
    const blob = new Blob(
      [`Title,Price,Stock,Start Date,End Date,Shop\n${csvData.join("\n")}`],
      { type: "text/csv;charset=utf-8" }
    );
    saveAs(blob, `events-page-${page}.csv`);
  };

  return (
    <div className="w-full min-h-screen p-8 bg-black text-white text-sm">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-bold tracking-wide">All Events</h2>
        <button
          onClick={exportToCSV}
          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm flex items-center gap-2"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Breadcrumbs */}
      <div className="mb-4">
        <BreadCrumbs title="All Events" />
      </div>

      {/* Search Bar */}
      <div className="mb-4 flex items-center bg-gray-900 p-2 rounded-md flex-1">
        <Search size={18} className="text-gray-400 mr-2" />
        <input
          type="text"
          placeholder="Search events..."
          className="w-full bg-transparent text-white outline-none"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-gray-900 rounded-lg p-4">
        {isLoading ? (
          <p className="text-center text-white">Loading events...</p>
        ) : (
          <table className="w-full text-white">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-gray-800">
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="p-3 text-left">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-800 hover:bg-gray-900 transition"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination Controls */}
        <div className="flex justify-between items-center mt-4">
          <button
            className="px-4 py-2 bg-blue-600 rounded text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page === 1}
          >
            Previous
          </button>

          <span className="text-gray-300">
            Page {page} of {totalPages || 1}
          </span>

          <button
            className="px-4 py-2 bg-blue-600 rounded text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventsPage;
