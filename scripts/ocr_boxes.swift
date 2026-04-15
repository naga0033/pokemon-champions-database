// macOS Vision OCR with bounding boxes
// usage: swift ocr_boxes.swift <image_path>
import Foundation
import Vision
import AppKit

struct Row: Encodable {
    let text: String
    let x: Double
    let y: Double
    let w: Double
    let h: Double
}

guard CommandLine.arguments.count > 1 else {
    FileHandle.standardError.write("usage: ocr_boxes.swift <image_path>\n".data(using: .utf8)!)
    exit(1)
}

let path = CommandLine.arguments[1]
guard let img = NSImage(contentsOfFile: path),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    FileHandle.standardError.write("failed to load image\n".data(using: .utf8)!)
    exit(1)
}

var rows: [Row] = []
let req = VNRecognizeTextRequest { request, _ in
    guard let obs = request.results as? [VNRecognizedTextObservation] else { return }
    for item in obs {
        guard let candidate = item.topCandidates(1).first else { continue }
        let box = item.boundingBox
        rows.append(
            Row(
                text: candidate.string,
                x: Double(box.origin.x),
                y: Double(box.origin.y),
                w: Double(box.size.width),
                h: Double(box.size.height)
            )
        )
    }
}
req.recognitionLanguages = ["ja", "en", "ko", "zh-Hans", "zh-Hant"]
req.recognitionLevel = .accurate
req.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: cg, options: [:])
try handler.perform([req])

rows.sort {
    let ay = $0.y + $0.h / 2
    let by = $1.y + $1.h / 2
    if abs(ay - by) > 0.01 { return ay > by }
    return $0.x < $1.x
}

let encoder = JSONEncoder()
if let data = try? encoder.encode(rows) {
    FileHandle.standardOutput.write(data)
}
