{
  "targets": [
    {
      "target_name": "webrtc_node",
      "sources": [
        "native-bindings/webrtc_binding.cc",
        "native-bindings/peer_connection.cc",
        "native-bindings/data_channel.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "frameworks/WebRTC.framework/Headers"
      ],
      "libraries": [
        "-framework WebRTC",
        "-F../frameworks",
        "-framework Foundation",
        "-framework CoreMedia",
        "-framework CoreVideo",
        "-framework CoreAudio",
        "-framework AudioToolbox",
        "-framework VideoToolbox",
        "-framework AVFoundation"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.15",
            "OTHER_CFLAGS": [
              "-std=c++17",
              "-stdlib=libc++"
            ],
            "OTHER_LDFLAGS": [
              "-framework WebRTC",
              "-F../frameworks",
              "-Wl,-rpath,@loader_path/../frameworks"
            ]
          }
        }]
      ]
    }
  ]
}