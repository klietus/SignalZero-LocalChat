
import { FunctionDeclaration, Type } from "@google/genai";

// Declarations are kept for reference or if the UI needs to display them,
// but the client-side executor is removed.

export const toolDeclarations: FunctionDeclaration[] = []; // Fetched from server if needed

export const createToolExecutor = (getApiKey: () => string | null) => {
  return async (name: string, args: any): Promise<any> => {
    console.warn("Client-side tool execution is deprecated. The kernel (server) handles tools.");
    return null;
  };
};
