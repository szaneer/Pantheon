// Polyfills for Node.js globals in browser environment
import process from 'process';
import { Buffer } from 'buffer';
import { EventEmitter } from 'events';

// Make globals available
(globalThis as any).process = process;
(globalThis as any).Buffer = Buffer;
(globalThis as any).global = globalThis;

// Ensure process.env exists
if (!process.env) {
  process.env = {};
}

// Add process.nextTick if missing
if (!process.nextTick) {
  process.nextTick = (callback: Function, ...args: any[]) => {
    setTimeout(() => callback(...args), 0);
  };
}

// Ensure EventEmitter is available
if (!(globalThis as any).EventEmitter) {
  (globalThis as any).EventEmitter = EventEmitter;
}

export {};