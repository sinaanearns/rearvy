"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./clicky.module.css";
import { MousePointer2, Mic, Play, Settings, X, Search, Zap } from "lucide-react";

export default function ClickyPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState("Ready");
  const [isBusy, setIsBusy] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse Following Logic
  useEffect(() => {
    if (!isFollowing || isOpen) return;

    const interval = setInterval(async () => {
      if ((window as any).electron) {
        const mousePos = await (window as any).electron.clicky.getMousePosition();
        // Offset to center Clicky near the mouse
        (window as any).electron.clicky.setPosition(mousePos.x + 20, mousePos.y + 20);
      }
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [isFollowing, isOpen]);

  // Adjust window size based on panel state
  useEffect(() => {
    if ((window as any).electron) {
      if (isOpen) {
        (window as any).electron.clicky.setSize(320, 400);
      } else {
        (window as any).electron.clicky.setSize(100, 100);
      }
    }
  }, [isOpen]);

  // Listen for status updates from the brain
  useEffect(() => {
    if ((window as any).electron) {
      const unsubscribe = (window as any).electron.clicky.onStatus((newStatus: string) => {
        setStatus(newStatus);
        if (newStatus !== "Ready") {
          setIsBusy(true);
        } else {
          setIsBusy(false);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setIsFollowing(false);
    } else {
      // Small delay before following again
      setTimeout(() => setIsFollowing(true), 500);
    }
  };

  const handleAction = async (action: string) => {
    try {
      if ((window as any).electron) {
        await (window as any).electron.clicky.runCommand(action);
      }
    } catch (err) {
      console.error("Failed to run clicky command:", err);
      setStatus("Error");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText) return;
    handleAction(inputText);
    setInputText("");
  };

  return (
    <div className={styles.clickyContainer} ref={containerRef}>
      <div 
        className={`${styles.clickyIcon} ${isBusy ? styles.active : ""}`}
        onClick={handleToggle}
      >
        <Zap size={24} color="white" fill="white" />
      </div>

      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.title}>
            <Zap size={16} color="#3b82f6" />
            Rearvy Clicky
          </div>
          
          <form onSubmit={handleSubmit}>
            <input 
              className={styles.input}
              placeholder="Tell Clicky to do something..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              autoFocus
            />
          </form>

          <div className={styles.actionGrid}>
            <button className={styles.actionBtn} onClick={() => handleAction("Setup Shopify")}>
              <Play size={14} /> Setup Shopify
            </button>
            <button className={styles.actionBtn} onClick={() => handleAction("Check Portfolio")}>
              <Search size={14} /> Check Portfolio
            </button>
            <button className={styles.actionBtn} onClick={() => handleAction("Voice Command")}>
              <Mic size={14} /> Voice
            </button>
            <button className={styles.actionBtn} onClick={() => setIsFollowing(!isFollowing)}>
              <MousePointer2 size={14} /> {isFollowing ? "Pause Follow" : "Follow Mouse"}
            </button>
          </div>

          <div className={styles.status}>
            <div className={styles.statusDot} style={{ background: isBusy ? "#f59e0b" : "#10b981" }} />
            {status}
          </div>
        </div>
      )}
    </div>
  );
}
