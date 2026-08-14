import React from 'react';

export default function OXIcon({ className = '', title = 'OX' }) {
  return <svg viewBox="0 0 64 64" role="img" aria-label={title} className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 8H18L8 18v28l10 10h18" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M19 43V31m9 12V23m9 20V34" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity=".8"/>
    <path d="M39 20l17 24M56 20L39 44" stroke="#F97316" strokeWidth="7" strokeLinecap="round"/>
  </svg>;
}
