/**
 * `@agenti/core` - The core agent framework for building LLM-powered agents with tool use.
 *
 * This package provides the foundational primitives for creating agents that
 * can reason, invoke tools, and maintain conversation state:
 *
 * - {@link createAgent} - Factory function for creating agent instances.
 * - {@link defineTool} - Helper for defining type-safe tools with Zod or JSON Schema.
 * - {@link AgentError} - Structured error class for agent failures.
 *
 * @module @agenti/core
 */

export { createAgent } from './agent'
export { defineTool } from './tool'
export { AgentError } from './errors'
export type { AgentErrorCode } from './errors'

export type {
    Role,
    ToolCall,
    Message,
    ToolContext,
    JsonSchema,
    ToolJsonSchema,
    Tool,
    ChatParams,
    ModelResponse,
    StreamEvent,
    ModelProvider,
    AgentActionType,
    ActionPayloadMap,
    AgentAction,
    Middleware,
    MemoryProvider,
    AgentConfig,
    ExecutedToolCall,
    UsageStats,
    AgentResult,
    RunOptions,
    Agent,
} from './types'
