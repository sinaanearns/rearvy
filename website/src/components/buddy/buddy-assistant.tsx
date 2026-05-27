"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import styles from "./buddy.module.css";
import { Mic, Send, Camera, X, MessageCircle, BarChart3, Minimize2 } from "lucide-react";
import { getIdToken } from "@/lib/firebase/auth";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Pointer {
  x: number;
  y: number;
  label: string;
}

export const BuddyAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activePointer, setActivePointer] = useState<Pointer | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<any>(null);

  // Initialize Web Speech API
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = "en-US";

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputText(transcript);
          handleSendMessage(transcript);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => setIsListening(false);
        recognitionRef.current.onerror = () => setIsListening(false);
      }
      synthesisRef.current = window.speechSynthesis;
    }
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Pointer logic - clear after 5s
  useEffect(() => {
    if (activePointer) {
      const timer = setTimeout(() => setActivePointer(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [activePointer]);

  // Global keyboard shortcut (Alt+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "b") {
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleToggle = () => setIsOpen(!isOpen);

  const startListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const speak = (text: string) => {
    if (!synthesisRef.current) return;
    synthesisRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    synthesisRef.current.speak(utterance);
  };

  const captureAndAnalyze = async () => {
    try {
      setIsAnalyzing(true);
      let base64 = "";

      // Prefer native Electron capture if available (no user prompt)
      if ((window as any).electron?.system?.captureScreen) {
        const dataUrl = await (window as any).electron.system.captureScreen();
        if (dataUrl) {
          base64 = dataUrl.split(",")[1];
        }
      } 
      
      // Fallback to browser getDisplayMedia
      if (!base64) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const track = stream.getVideoTracks()[0];
        const imageCapture = new (window as any).ImageCapture(track);
        const bitmap = await imageCapture.grabFrame();
        
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(bitmap, 0, 0);
        base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
        
        track.stop();
        stream.getTracks().forEach(t => t.stop());
      }

      if (base64) {
        // Send to AI
        await handleSendMessage("Analyze my screen for financial insights.", base64);
      }
    } catch (error) {
      console.error("Screen capture failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const parsePointer = (text: string) => {
    const match = text.match(/\[POINT:([\d.]+),([\d.]+):([^\]]+)\]/);
    if (match) {
      return {
        x: parseFloat(match[1]),
        y: parseFloat(match[2]),
        label: match[3]
      };
    }
    return null;
  };

  async function handleSendMessage(text?: string, screenshot?: string) {
    const content = text || inputText;
    if (!content && !screenshot) return;

    const userMsg: Message = { role: "user", content };
    setMessages(prev => [...prev, userMsg]);
    setInputText("");

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Sign in to use Rearvy Buddy.");
      }

      const response = await fetch("/api/buddy/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: content,
          screenshot,
          history: messages.slice(-5)
        })
      });

      if (!response.ok) throw new Error("Failed to chat");

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response stream is unavailable.");
      }

      const decoder = new TextDecoder();
      let assistantText = "";
      
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        assistantText += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last.role === "assistant") {
            return [...prev.slice(0, -1), { ...last, content: assistantText }];
          }
          return prev;
        });
      }

      // After streaming finish, check for pointers and speak
      const pointer = parsePointer(assistantText);
      if (pointer) setActivePointer(pointer);

      const cleanText = assistantText.replace(/\[POINT:[^\]]+\]/g, "").trim();
      speak(cleanText);

    } catch (error) {
      console.error("Chat failed:", error);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I'm having trouble connecting right now." }]);
    }
  }

  return (
    <div className={styles.buddyContainer}>
      {activePointer && (
        <div className={styles.pointerContainer}>
          <div 
            className={styles.pointer} 
            style={{ left: `${activePointer.x * 100}%`, top: `${activePointer.y * 100}%` }}
          >
            <div className={styles.pointerLabel}>{activePointer.label}</div>
          </div>
        </div>
      )}

      {isOpen && (
        <div className={styles.chatPanel}>
          <div className={styles.chatHeader}>
            <div className={styles.headerTitle}>
              <div className={styles.statusIndicator} />
              Rearvy Buddy
            </div>
            <button className={styles.actionBtn} onClick={handleToggle}>
              <Minimize2 size={18} />
            </button>
          </div>

          <div className={styles.chatMessages} ref={scrollRef}>
            {messages.length === 0 && (
              <div className={styles.assistantMessage} style={{ alignSelf: "center", background: "transparent", textAlign: "center" }}>
                <BarChart3 size={48} style={{ opacity: 0.2, marginBottom: 12, margin: "0 auto" }} />
                <p style={{ opacity: 0.6 }}>Hi! I&apos;m your Rearvy Buddy. Ask me about your finances or show me your screen for analysis.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`${styles.message} ${m.role === "user" ? styles.userMessage : styles.assistantMessage}`}>
                {m.content.replace(/\[POINT:[^\]]+\]/g, "")}
              </div>
            ))}
          </div>

          <div className={styles.chatInput}>
            <button 
              className={`${styles.actionBtn} ${isListening ? styles.active : ""}`}
              onClick={startListening}
              title="Voice Input"
            >
              <Mic size={20} />
            </button>
            <button 
              className={`${styles.actionBtn} ${isAnalyzing ? styles.active : ""}`}
              onClick={captureAndAnalyze}
              title="Capture Screen"
            >
              <Camera size={20} />
            </button>
            <input 
              className={styles.inputField}
              placeholder="Ask me anything..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            />
            <button className={`${styles.actionBtn} ${styles.sendBtn}`} onClick={() => handleSendMessage()}>
              <Send size={20} />
            </button>
          </div>
        </div>
      )}

      <div 
        className={`${styles.buddyIcon} ${isSpeaking ? styles.active : ""}`} 
        onClick={handleToggle}
      >
        <div className={styles.glowEffect} />
        {isAnalyzing ? (
          <div className={styles.pulse} />
        ) : (
          <Image
            src="/buddy_icon.png" 
            alt="Buddy" 
            width={64}
            height={64}
            className={styles.buddyIconImage}
          />
        )}
      </div>
    </div>
  );
};
