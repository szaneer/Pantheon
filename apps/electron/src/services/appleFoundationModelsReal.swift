import Foundation
import FoundationModels

@objc public class AppleFoundationModelsService: NSObject {
    private var languageModel: SystemLanguageModel?
    private var sessions: [String: LanguageModelSession] = [:]
    
    @objc public override init() {
        super.init()
        self.languageModel = SystemLanguageModel.default
    }
    
    @objc public func checkSupport() -> Bool {
        let model = SystemLanguageModel.default
        
        switch model.availability {
        case .available:
            return true
        case .unavailable(let reason):
            print("Foundation Models unavailable: \(reason)")
            return false
        @unknown default:
            return false
        }
    }
    
    @objc public func getAvailability() -> [String: Any] {
        let model = SystemLanguageModel.default
        
        switch model.availability {
        case .available:
            return ["available": true]
        case .unavailable(let reason):
            var reasonString = "Unknown"
            switch reason {
            case .appleIntelligenceNotEnabled:
                reasonString = "Apple Intelligence is not enabled"
            case .restrictedRegion:
                reasonString = "Not available in this region"
            @unknown default:
                reasonString = "Unknown reason"
            }
            return ["available": false, "reason": reasonString]
        @unknown default:
            return ["available": false, "reason": "Unknown status"]
        }
    }
    
    @objc public func getModels() -> [[String: Any]] {
        guard checkSupport() else { return [] }
        
        // Apple provides one unified model
        return [[
            "id": "com.apple.foundation.language",
            "name": "Apple Language Model",
            "object": "model",
            "created": Int(Date().timeIntervalSince1970),
            "owned_by": "apple",
            "description": "On-device language model powering Apple Intelligence",
            "capabilities": ["chat", "completion", "text-generation", "summarization"],
            "maxTokens": 4096
        ]]
    }
    
    @objc public func createChatCompletion(request: [String: Any]) async throws -> [String: Any] {
        guard checkSupport() else {
            throw NSError(domain: "AppleFoundationModels", code: 1, 
                         userInfo: [NSLocalizedDescriptionKey: "Foundation Models not available"])
        }
        
        let sessionId = request["sessionId"] as? String ?? UUID().uuidString
        let messages = request["messages"] as? [[String: Any]] ?? []
        let temperature = request["temperature"] as? Double ?? 0.7
        let maxTokens = request["max_tokens"] as? Int ?? 2048
        let stream = request["stream"] as? Bool ?? false
        
        // Get or create session
        let session = sessions[sessionId] ?? LanguageModelSession()
        sessions[sessionId] = session
        
        // Convert messages to prompt
        var promptText = ""
        var systemPrompt = ""
        
        for message in messages {
            let role = message["role"] as? String ?? ""
            let content = message["content"] as? String ?? ""
            
            switch role {
            case "system":
                systemPrompt = content
            case "user":
                promptText += "User: \(content)\n"
            case "assistant":
                promptText += "Assistant: \(content)\n"
            default:
                break
            }
        }
        
        // Add final user prompt
        if !promptText.isEmpty {
            promptText += "Assistant: "
        }
        
        // Create prompt with optional system instructions
        let prompt: Prompt
        if !systemPrompt.isEmpty {
            prompt = Prompt(promptText, instructions: systemPrompt)
        } else {
            prompt = Prompt(promptText)
        }
        
        // Generate response
        let startTime = Date()
        
        if stream {
            // Streaming response
            var fullResponse = ""
            let responseStream = try await session.respond(to: prompt, streamType: .partial)
            
            for try await partial in responseStream {
                fullResponse = partial
                // In a real implementation, we'd send each chunk via callback
            }
            
            return createResponse(
                content: fullResponse,
                model: "com.apple.foundation.language",
                promptTokens: promptText.count / 4, // Rough estimate
                completionTokens: fullResponse.count / 4,
                startTime: startTime
            )
        } else {
            // Non-streaming response
            let response = try await session.respond(to: prompt)
            
            return createResponse(
                content: response,
                model: "com.apple.foundation.language",
                promptTokens: promptText.count / 4,
                completionTokens: response.count / 4,
                startTime: startTime
            )
        }
    }
    
    private func createResponse(content: String, model: String, 
                               promptTokens: Int, completionTokens: Int, 
                               startTime: Date) -> [String: Any] {
        return [
            "id": "chatcmpl-\(UUID().uuidString)",
            "object": "chat.completion",
            "created": Int(Date().timeIntervalSince1970),
            "model": model,
            "system_fingerprint": "apple_foundation_v1",
            "choices": [[
                "index": 0,
                "message": [
                    "role": "assistant",
                    "content": content
                ],
                "logprobs": NSNull(),
                "finish_reason": "stop"
            ]],
            "usage": [
                "prompt_tokens": promptTokens,
                "completion_tokens": completionTokens,
                "total_tokens": promptTokens + completionTokens
            ]
        ]
    }
    
    @objc public func clearSession(sessionId: String) {
        sessions.removeValue(forKey: sessionId)
    }
    
    @objc public func clearAllSessions() {
        sessions.removeAll()
    }
}