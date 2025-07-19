#include <napi.h>
#include <WebRTC/WebRTC.h>
#include "peer_connection.h"

Napi::Object CreateRTCPeerConnection(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return PeerConnection::NewInstance(env, info[0]);
}

Napi::Object CreateRTCSessionDescription(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object obj = Napi::Object::New(env);
    
    if (info.Length() > 0 && info[0].IsObject()) {
        Napi::Object init = info[0].As<Napi::Object>();
        
        if (init.Has("type")) {
            obj.Set("type", init.Get("type"));
        }
        if (init.Has("sdp")) {
            obj.Set("sdp", init.Get("sdp"));
        }
    }
    
    return obj;
}

Napi::Object CreateRTCIceCandidate(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object obj = Napi::Object::New(env);
    
    if (info.Length() > 0 && info[0].IsObject()) {
        Napi::Object init = info[0].As<Napi::Object>();
        
        if (init.Has("candidate")) {
            obj.Set("candidate", init.Get("candidate"));
        }
        if (init.Has("sdpMLineIndex")) {
            obj.Set("sdpMLineIndex", init.Get("sdpMLineIndex"));
        }
        if (init.Has("sdpMid")) {
            obj.Set("sdpMid", init.Get("sdpMid"));
        }
    }
    
    return obj;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // Initialize the native binding
    PeerConnection::Init(env, exports);
    
    // Export main WebRTC classes
    exports.Set("RTCPeerConnection", Napi::Function::New(env, CreateRTCPeerConnection));
    exports.Set("RTCSessionDescription", Napi::Function::New(env, CreateRTCSessionDescription));
    exports.Set("RTCIceCandidate", Napi::Function::New(env, CreateRTCIceCandidate));
    
    // Export constants
    exports.Set("version", Napi::String::New(env, "1.0.0"));
    exports.Set("isNativeImplementation", Napi::Boolean::New(env, true));
    
    return exports;
}

NODE_API_MODULE(webrtc_node, Init)