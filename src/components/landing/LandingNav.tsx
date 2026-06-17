"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { IconArrowRight } from "./Icons";

export function LandingNav() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`nav-wrap ${scrolled ? "scrolled" : ""}`}>
      <div className="page">
        <nav className="nav">
          <Link className="brand" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="MarkTasks" style={{ height: 44, width: "auto", display: "block" }} />
          </Link>
          <div className="nav-links">
            <a className="nav-link" href="#product">Product</a>
            <a className="nav-link" href="#features">Features</a>
            <a className="nav-link" href="#">Customers</a>
            <a className="nav-link" href="#">Changelog</a>
          </div>
          <div className="nav-right">
            {user ? (
              <Link className="btn btn-primary" href="/boards">
                Open dashboard <IconArrowRight size={13} />
              </Link>
            ) : (
              <>
                <Link className="btn btn-ghost" href="/login">
                  Sign in
                </Link>
                <Link className="btn btn-primary" href="/register">
                  Start free <IconArrowRight size={13} />
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}
