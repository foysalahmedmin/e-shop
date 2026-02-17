"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import ChatInput from "apps/seller-ui/src/shared/components/chatinput";
import useSeller from "apps/seller-ui/src/hooks/useSeller";
import { useWebSocket } from "apps/seller-ui/src/context/web-socket-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "apps/seller-ui/src/utils/axiosInstance";

const ChatPage = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const messageContainerRef = useRef<HTMLDivElement | null>(null);
  const { seller, isLoading: userLoading } = useSeller();
  const conversationId = searchParams.get("conversationId");
  const queryClient = useQueryClient();
  const { ws } = useWebSocket();

  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [message, setMessage] = useState("");
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      if (!conversationId || hasFetchedOnce) return [];
      const res = await axiosInstance.get(
        `/chatting/api/get-seller-messages/${conversationId}?page=1`
      );
      setHasFetchedOnce(true);
      return res.data.messages.reverse();
    },
    enabled: !!conversationId,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (!conversationId || messages.length === 0) return;
    const timeout = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeout);
  }, [conversationId, messages.length]);

  useEffect(() => {
    if (conversationId && chats.length > 0) {
      const chat = chats.find((c) => c.conversationId === conversationId);
      setSelectedChat(chat || null);
    }
  }, [conversationId, chats]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        const container = messageContainerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 50);
    });
  };

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await axiosInstance.get(
        "/chatting/api/get-seller-conversations"
      );
      return res.data.conversations;
    },
  });

  useEffect(() => {
    if (conversations) setChats(conversations);
  }, [conversations]);

  useEffect(() => {
    if (!ws) return;

    ws.onmessage = (event: any) => {
      const data = JSON.parse(event.data);

      if (data.type === "NEW_MESSAGE") {
        const newMsg = data?.payload;

        if (newMsg.conversationId === conversationId) {
          queryClient.setQueryData(
            ["messages", conversationId],
            (old: any = []) => [
              ...old,
              {
                content: newMsg.messageBody || newMsg.content || "",
                senderType: newMsg.senderType,
                seen: false,
                createdAt: newMsg.createdAt || new Date().toISOString(),
              },
            ]
          );
          scrollToBottom();
        }

        setChats((prevChats) =>
          prevChats.map((chat) =>
            chat.conversationId === newMsg.conversationId
              ? { ...chat, lastMessage: newMsg.content }
              : chat
          )
        );
      }

      if (data.type === "UNSEEN_COUNT_UPDATE") {
        const { conversationId, count } = data.payload;
        setChats((prevChats) =>
          prevChats.map((chat) =>
            chat.conversationId === conversationId
              ? { ...chat, unreadCount: count }
              : chat
          )
        );
      }
    };
  }, [ws, conversationId]);

  const handleChatSelect = (chat: any) => {
    setHasFetchedOnce(false);
    setChats((prev) =>
      prev.map((c) =>
        c.conversationId === chat.conversationId ? { ...c, unreadCount: 0 } : c
      )
    );
    router.push(`?conversationId=${chat.conversationId}`);

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "MARK_AS_SEEN",
          conversationId: chat.conversationId,
        })
      );
    }
  };

  const handleSend = (e: any) => {
    e.preventDefault();
    if (
      !message.trim() ||
      !selectedChat ||
      !ws ||
      ws.readyState !== WebSocket.OPEN
    )
      return;

    const payload = {
      fromUserId: seller.id,
      toUserId: selectedChat.user.id,
      messageBody: message,
      conversationId: selectedChat.conversationId,
      senderType: "seller",
    };

    ws.send(JSON.stringify(payload));

    setMessage("");
    scrollToBottom();
  };

  return (
    <div className="w-full">
      <div className="flex h-screen shadow-inner overflow-hidden bg-gray-950 text-gray-200">
        {/* Sidebar */}
        <div className="w-[320px] border-r border-gray-800 bg-gray-950">
          <div className="p-4 border-b border-gray-800 text-lg font-semibold">
            Messages
          </div>
          <div className="divide-y divide-gray-900">
            {isLoading ? (
              <div className="text-center py-5 text-sm">Loading...</div>
            ) : chats.length === 0 ? (
              <p className="text-center py-5 text-sm">
                No conversation available yet!
              </p>
            ) : (
              chats.map((chat) => {
                const isActive =
                  selectedChat?.conversationId === chat.conversationId;

                return (
                  <button
                    key={chat.conversationId}
                    onClick={() => handleChatSelect(chat)}
                    className={`w-full text-left px-4 py-3 transition ${
                      isActive ? "bg-blue-950" : "hover:bg-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Image
                        src={
                          chat.user?.avatar ||
                          "https://ik.imagekit.io/shahriarbecodemy/avatar/6_t8b5y8t3U.png"
                        }
                        alt={chat.user?.name}
                        width={36}
                        height={36}
                        className="rounded-full border w-[40px] h-[40px] object-cover"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-white">
                            {chat.user?.name}
                          </span>
                          {chat.user?.isOnline && (
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-400 truncate max-w-[170px]">
                            {chat.lastMessage || ""}{" "}
                          </p>
                          {chat?.unreadCount > 0 && (
                            <span className="ml-2 text-[10px] bg-blue-600 text-white rounded-full px-1.5 py-0.5">
                              {chat?.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Content */}
        <div className="flex flex-col flex-1 bg-gray-950">
          {selectedChat ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-gray-800 bg-gray-900 flex items-center gap-3">
                <Image
                  src={
                    selectedChat.user?.avatar ||
                    "https://ik.imagekit.io/shahriarbecodemy/avatar/6_t8b5y8t3U.png"
                  }
                  alt={selectedChat.user.name}
                  width={40}
                  height={40}
                  className="rounded-full border w-[40px] h-[40px] object-cover border-gray-700"
                />
                <div>
                  <h2 className="text-white font-semibold text-base">
                    {selectedChat.user?.name}{" "}
                  </h2>
                  <p className="text-xs text-gray-400">
                    {selectedChat.user?.isOnline ? "Online" : "Offline"}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div
                className="flex-1 overflow-y-auto px-6 py-6 space-y-4 text-sm"
                ref={messageContainerRef}
              >
                {messages.map((msg: any, idx: number) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      msg.senderType === "seller"
                        ? "items-end ml-auto"
                        : "items-start"
                    } max-w-[80%]`}
                  >
                    <div
                      className={`${
                        msg.senderType === "seller"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-800 text-gray-200"
                      } px-4 py-2 rounded-lg shadow-sm w-fit`}
                    >
                      {msg.content}
                    </div>
                    <div
                      className={`text-[11px] text-gray-400 mt-1 flex items-center gap-1 ${
                        msg.senderType === "seller"
                          ? "mr-1 justify-end"
                          : "ml-1"
                      }`}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <ChatInput
                message={message}
                setMessage={setMessage}
                onSendMessage={handleSend}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              Select a conversation to start chatting
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
