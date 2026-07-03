"use client";

import { useState, useEffect } from "react";
import {
  hoareChat,
  hoareExecute,
  hoareListTools,
  hoareSessionCreate,
  hoareSessionList,
} from "@/lib/hoare-client";

export type Message = { role: "user" | "assistant"; content: string };

export type HoareTool = {
  name: string;
  description?: string;
  parameters?: Record<string, string>;
};

export type HoareSession = {
  id: string;
  createdAt?: string;
  messages?: number;
  [key: string]: unknown;
};

export function useHoare() {
  const [session, setSession] = useState<HoareSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tools, setTools] = useState<HoareTool[]>([]);
  const [sessions, setSessions] = useState<HoareSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hoareSessionCreate()
      .then(setSession)
      .catch((err: Error) => setError(err.message));

    hoareListTools()
      .then((data) => setTools(Array.isArray(data) ? data : data?.tools ?? []))
      .catch((err: Error) => setError(err.message));

    hoareSessionList()
      .then((data) => setSessions(Array.isArray(data) ? data : data?.sessions ?? []))
      .catch((err: Error) => setError(err.message));
  }, []);

  async function sendMessage(text: string) {
    setLoading(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    try {
      const reply = await hoareChat(text);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply?.reply ?? JSON.stringify(reply) },
      ]);
      return reply;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function runTool(toolName: string, payload: Record<string, unknown> = {}) {
    setLoading(true);
    setError(null);
    try {
      return await hoareExecute(toolName, payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  return {
    session,
    messages,
    tools,
    sessions,
    loading,
    error,
    sendMessage,
    runTool,
  };
}
