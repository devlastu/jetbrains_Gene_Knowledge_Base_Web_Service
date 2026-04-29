/**
 * Rich Explain-panel copy merged onto nodes in graph-data.js.
 * Fields: explainFocus (request context), whenItFails (debugging), relatedFiles (further reading).
 */
export const explainByNodeId = {
  main: {
    explainFocus: "Every HTTP request enters here first: the ASGI app is already built; middleware and routes are wired before your handler runs.",
    whenItFails: "Startup crashes usually mean import errors, bad env, or invalid SERVICE_ROUTER_MAP. Runtime 404s are routing, not this file.",
    relatedFiles: ["tt-media-server/main.py", "tt-media-server/settings.py", "tt-media-server/service_router_map.py"],
  },
  mw_auth: {
    explainFocus: "For protected routes, this gate runs before the router: credentials are checked once per request unless the path is allowlisted.",
    whenItFails: "401: missing/invalid token or API key. Check Authorization / x-api-key headers and JWT expiry. Whitelist for /health and /docs if you expect anonymous access.",
    relatedFiles: ["security/api_key_checker.py", "security/jwt_utils.py"],
  },
  mw_cors: {
    explainFocus: "Browser clients need CORS headers on responses and often an OPTIONS preflight; this middleware wraps the app so routers stay unaware of origin policy.",
    whenItFails: "Browser shows CORS errors while curl works: fix allow_origins / credentials, or handle OPTIONS on the right routes.",
    relatedFiles: ["tt-media-server/main.py"],
  },
  mw_metrics: {
    explainFocus: "Each request is timed and counted for Prometheus; this is how you get latency histograms and error rates in dashboards.",
    whenItFails: "Missing metrics: exporter not scraped or middleware order wrong. Spikes: look at downstream services, not this layer first.",
    relatedFiles: ["telemetry/prometheus_metrics.py"],
  },
  mw_health: {
    explainFocus: "Orchestrators hit /health for liveness; this node is the probe surface, optionally checking device and worker health.",
    whenItFails: "Pod restarts: health returns non-200 when device or workers are down—check tt-smi and worker logs before the API layer.",
    relatedFiles: ["open_ai_api/health.py"],
  },
  router_llm: {
    explainFocus: "OpenAI-compatible chat/completions land here: body is validated, then the right service is resolved and streaming may begin.",
    whenItFails: "422: Pydantic validation. 500 after validation: resolver, scheduler, or runner—trace the model path in Explain’s journey strip.",
    relatedFiles: ["open_ai_api/llm.py", "domain/completion_request.py"],
  },
  router_audio: {
    explainFocus: "Multipart audio uploads for transcription: file limits and model id are validated before AudioService runs Whisper.",
    whenItFails: "413/400 on upload: size or format. Empty transcript: check audio codec after AudioManager conversion.",
    relatedFiles: ["open_ai_api/audio.py", "domain/audio_processing_request.py"],
  },
  router_tts: {
    explainFocus: "TTS requests are validated (text, voice, format) then handed to TTSService and SpeechT5 on device.",
    whenItFails: "Garbled or silent audio: wrong sample rate or vocoder path; verify SpeechT5 config and ffmpeg availability.",
    relatedFiles: ["open_ai_api/text_to_speech.py", "domain/text_to_speech_request.py"],
  },
  router_image: {
    explainFocus: "Image generation/editing requests are validated (prompt, size, n) then SDXL pipeline runs via ImageService.",
    whenItFails: "OOM or timeout: reduce resolution or batch size; black images often mean VAE decode or scheduler mismatch.",
    relatedFiles: ["open_ai_api/image.py", "domain/image_generate_request.py"],
  },
  router_video: {
    explainFocus: "Video jobs are long-running: validation, then async job tracking may apply before DiT + VideoManager produce a file.",
    whenItFails: "Stuck jobs: inspect JobManager state and worker logs; OOM on device: lower frames or resolution in config.",
    relatedFiles: ["open_ai_api/video.py", "domain/video_generate_request.py", "utils/job_manager.py"],
  },
  router_embedding: {
    explainFocus: "Embeddings are simple request/response but batching and model id must match the runner you expect.",
    whenItFails: "Wrong vector dim: client expected a different embed model. NaNs: check tokenizer + max_seq_len.",
    relatedFiles: ["open_ai_api/embedding.py", "domain/text_embedding_request.py"],
  },
  router_cnn: {
    explainFocus: "Image classification: image tensor path goes through CNNService to a vision runner on TT.",
    whenItFails: "Shape mismatch: ImageManager resize vs model input. Wrong labels: class map vs training checkpoint.",
    relatedFiles: ["open_ai_api/cnn.py"],
  },
  router_finetune: {
    explainFocus: "Training jobs are created asynchronously; response is a job id for polling, not finished weights.",
    whenItFails: "Job failed: dataset JSONL format, disk space, or GPU/TT allocation—check TrainingService logs.",
    relatedFiles: ["open_ai_api/fine_tuning.py", "domain/training_request.py"],
  },
  router_tokenizer: {
    explainFocus: "Utility route for encode/decode experiments; not on the hot inference path for chat completions.",
    whenItFails: "Vocab mismatch: tokenizer must match the model id you pass.",
    relatedFiles: ["open_ai_api/tokenizer.py"],
  },
  domain_completion: {
    explainFocus: "The JSON body becomes a typed CompletionRequest: invalid fields never reach the service layer.",
    whenItFails: "422 lists the exact field; stream=True requires compatible router response handling.",
    relatedFiles: ["domain/completion_request.py"],
  },
  domain_audio: {
    explainFocus: "Upload metadata and Whisper options are normalized here before audio bytes hit preprocessing.",
    whenItFails: "Unsupported mime or size: fix client upload; language hint wrong can hurt WER.",
    relatedFiles: ["domain/audio_processing_request.py"],
  },
  domain_tts: {
    explainFocus: "Voice, format, and text length constraints are enforced before synthesis.",
    whenItFails: "Long text may need chunking; voice id must exist in server config.",
    relatedFiles: ["domain/text_to_speech_request.py"],
  },
  domain_image: {
    explainFocus: "Prompt, n, size, and diffusion knobs are validated so SDXL never sees inconsistent shapes.",
    whenItFails: "Invalid size strings or too many images per request—see Pydantic error detail.",
    relatedFiles: ["domain/image_generate_request.py"],
  },
  domain_video: {
    explainFocus: "Frame count, fps, and resolution interact with memory; validation protects the DiT runner.",
    whenItFails: "Duration too long: job may be rejected or OOM downstream—trim prompt or frames.",
    relatedFiles: ["domain/video_generate_request.py"],
  },
  domain_embedding: {
    explainFocus: "Single or batch text inputs are normalized for the embedding model’s tokenizer.",
    whenItFails: "Batch too large: split client-side; encoding_format must match what the client parses.",
    relatedFiles: ["domain/text_embedding_request.py"],
  },
  domain_training: {
    explainFocus: "Hyperparameters and dataset references are checked before a training job is queued.",
    whenItFails: "Missing training file id or incompatible model name—verify upload pipeline first.",
    relatedFiles: ["domain/training_request.py"],
  },
  resolver: {
    explainFocus: "The router only knows a string key; this singleton maps it to a concrete service instance and caches it for reuse.",
    whenItFails: "KeyError or None: SERVICE_ROUTER_MAP / registry mismatch. Stale singleton: rare—restart after config deploy.",
    relatedFiles: ["resolver/service_resolver.py", "model_services/registry.py"],
  },
  svc_base: {
    explainFocus: "Concrete services inherit scheduling, queue interaction, and streaming hooks—this is the shared contract, not a runtime hop on every path visualization.",
    whenItFails: "Abstract method errors: subclass forgot process_request. Worker restarts: look at BaseService lifecycle in logs.",
    relatedFiles: ["model_services/base_service.py"],
  },
  svc_llm: {
    explainFocus: "Chat template, sampling params, and optional SSE streaming are orchestrated; work is enqueued for vLLM-backed workers.",
    whenItFails: "Empty stream: SSE path vs buffer. Hung requests: scheduler or worker deadlock—check queue depth.",
    relatedFiles: ["model_services/llm_service.py", "utils/sse_streamer.py"],
  },
  svc_audio: {
    explainFocus: "Audio is chunked and normalized for Whisper; results are merged for long files.",
    whenItFails: "ffmpeg failures: install/path. Partial transcripts: chunk boundary or language detection.",
    relatedFiles: ["model_services/audio_service.py", "utils/audio_manager.py"],
  },
  svc_tts: {
    explainFocus: "Text is tokenized for SpeechT5; waveform is encoded to the client’s requested format.",
    whenItFails: "Robotic audio: speaker embedding or vocoder mismatch. Timeout: reduce length.",
    relatedFiles: ["model_services/text_to_speech_service.py"],
  },
  svc_image: {
    explainFocus: "SDXL latents are generated then decoded and optionally job-tracked for async clients.",
    whenItFails: "CUDA/TT OOM during diffusion: lower steps or size in request or config.",
    relatedFiles: ["model_services/image_service.py", "utils/image_manager.py"],
  },
  svc_video: {
    explainFocus: "DiT frames become a video file via VideoManager; long runs may return job ids for polling.",
    whenItFails: "Disk full on temp MP4; OOM on Galaxy—reduce frames or switch device profile.",
    relatedFiles: ["model_services/video_service.py", "utils/video_manager.py", "utils/job_manager.py"],
  },
  svc_embedding: {
    explainFocus: "Batches texts, runs embedding runner, returns vectors in OpenAI-compatible shape.",
    whenItFails: "Zeros or NaNs: tokenizer truncation; compare embed_dim to client assumptions.",
    relatedFiles: ["model_services/embedding_service.py"],
  },
  svc_cnn: {
    explainFocus: "Image preprocessing + forward through CNN runner; outputs top-k logits as labels.",
    whenItFails: "Wrong aspect ratio after resize; normalization mean/std must match training.",
    relatedFiles: ["model_services/cnn_service.py"],
  },
  svc_training: {
    explainFocus: "Registers a training job and kicks async loop—not synchronous weight return.",
    whenItFails: "Dataset path invalid; GPU/TT not visible to training worker.",
    relatedFiles: ["model_services/training_service.py"],
  },
  scheduler: {
    explainFocus: "Picks FIFO vs batch queue by model type and hands back a future the service awaits.",
    whenItFails: "Tasks never complete: worker dead or queue full—metrics on put latency help.",
    relatedFiles: ["model_services/scheduler.py"],
  },
  queue_basic: {
    explainFocus: "Single-task FIFO for non-batched models: simple back-pressure between scheduler and worker.",
    whenItFails: "Blocking put: worker stuck on device hang—check lower layers.",
    relatedFiles: ["model_services/queues/tt_queue.py"],
  },
  queue_batch: {
    explainFocus: "Buffers requests until a batch threshold for continuous batching LLM throughput.",
    whenItFails: "Latency spikes if batch_size too high or flush logic starves small requests.",
    relatedFiles: ["model_services/queues/tt_batch_fifo_queue.py"],
  },
  worker_single: {
    explainFocus: "Process loop pulls one task, runs runner on device, resolves the future—classic request/response path.",
    whenItFails: "Watchdog kills: inference timeout or illegal memory on device.",
    relatedFiles: ["device_workers/device_worker.py"],
  },
  worker_dynamic: {
    explainFocus: "Pulls formed batches for vLLM-style continuous batching on TT.",
    whenItFails: "Batch collation errors: mixed sequence lengths without padding rules.",
    relatedFiles: ["device_workers/device_worker_dynamic_batch.py"],
  },
  runner_fabric: {
    explainFocus: "YAML config selects which runner class to import and warm up for this model.",
    whenItFails: "ImportError: runner module path wrong. Warmup hang: device not open.",
    relatedFiles: ["tt_model_runners/runner_fabric.py"],
  },
  runner_base: {
    explainFocus: "Shared interface for warmup/reset across all TT runners—conceptual base, not a separate runtime hop.",
    whenItFails: "Subclasses must implement run(); device OOM on warmup from bad dummy shapes.",
    relatedFiles: ["tt_model_runners/base_device_runner.py"],
  },
  runner_vllm: {
    explainFocus: "PagedAttention + sampling loop: this is where tokens become text on device for standard LLM paths.",
    whenItFails: "KV cache OOM: reduce max_seq_len or batch. Garbage output: bad chat template or sampling params.",
    relatedFiles: ["tt_model_runners/vllm_runner.py"],
  },
  runner_vllm_forge: {
    explainFocus: "Large models use Forge across a chip mesh; logits are gathered before sampling.",
    whenItFails: "Mesh timeout: chip link or shard mismatch—verify galaxy config vs physical topology.",
    relatedFiles: ["tt_model_runners/vllm_forge_llama_70b.py"],
  },
  runner_whisper: {
    explainFocus: "Mel → encoder → decoder loop for ASR; ends when EOT or max length.",
    whenItFails: "Silent mel: wrong sample rate upstream. Hallucinations: noisy input or VAD.",
    relatedFiles: ["tt_model_runners/whisper_runner.py"],
  },
  runner_speecht5: {
    explainFocus: "Encoder-decoder mel generation + vocoder to waveform for TTS.",
    whenItFails: "Clipping or noise: vocoder gain; speaker embedding mismatch.",
    relatedFiles: ["tt_model_runners/speecht5_runner.py"],
  },
  runner_sdxl: {
    explainFocus: "UNet steps + VAE decode for pixels; trace-optimized for TT execution.",
    whenItFails: "NaN latents: scheduler settings; black image: VAE scale factor.",
    relatedFiles: ["tt_model_runners/sdxl_generate_runner_trace.py"],
  },
  runner_dit: {
    explainFocus: "Spatio-temporal diffusion for video frames; may share utilities with image VAEs.",
    whenItFails: "OOM on frame tensor: reduce resolution or frame count in config.",
    relatedFiles: ["tt_model_runners/dit_runners.py"],
  },
  runner_embedding: {
    explainFocus: "Forward pass + pooling to a single vector per input for retrieval/RAG backends.",
    whenItFails: "Inconsistent dims across batches: pooling mode or max length differs.",
    relatedFiles: ["tt_model_runners/embedding_runner.py"],
  },
  runner_forge_qwen: {
    explainFocus: "Qwen embedding via Forge on TT—optimized graph for Qwen arch.",
    whenItFails: "Same as embedding runner; verify config points to this runner class.",
    relatedFiles: ["tt_model_runners/vllm_forge_qwen_embedding_runner.py"],
  },
  model_llama_8b: {
    explainFocus: "Single-chip Llama 3.1 8B profile: weights, seq len, and dtype live in YAML for RunnerFabric.",
    whenItFails: "OOM: context too long or wrong mesh=1x1 assumption.",
    relatedFiles: ["configs/llama_3_1_8b.yaml"],
  },
  model_llama_70b: {
    explainFocus: "70B sharded across Galaxy; tensor_parallel and device mesh must match hardware.",
    whenItFails: "Hang across chips: Ethernet fabric or rank mapping—check tt-smi mesh.",
    relatedFiles: ["configs/llama_3_1_70b.yaml"],
  },
  model_llama_3_3: {
    explainFocus: "Long-context 70B variant: RoPE scaling and max_seq_len differ from 3.1.",
    whenItFails: "Position errors at extreme lengths: rope_scaling not applied in runner.",
    relatedFiles: ["configs/llama_3_3_70b.yaml"],
  },
  model_qwen_7b: {
    explainFocus: "Multilingual 7B on one N150—good default for smaller deployments.",
    whenItFails: "Tokenizer vocab errors: model id must match weights on disk.",
    relatedFiles: ["configs/qwen_2_5_7b.yaml"],
  },
  model_falcon_40b: {
    explainFocus: "40B across partial Galaxy; TP degree matches chip count in YAML.",
    whenItFails: "Shard mismatch vs checkpoint files.",
    relatedFiles: ["configs/falcon_40b.yaml"],
  },
  model_whisper_l: {
    explainFocus: "Whisper Large v3 ASR profile: audio limits and beam search in config.",
    whenItFails: "WER spikes: language mismatch or truncated audio chunks.",
    relatedFiles: ["configs/whisper_large_v3.yaml"],
  },
  model_speecht5_ms: {
    explainFocus: "SpeechT5 TTS preset: sample rate ties vocoder and client playback.",
    whenItFails: "Speed/pitch off: wrong vocoder pairing in config.",
    relatedFiles: ["configs/speecht5.yaml"],
  },
  model_sdxl_base: {
    explainFocus: "SDXL base resolution and default steps baked in for image jobs.",
    whenItFails: "OOM at native 1024: fall back to smaller size in API request.",
    relatedFiles: ["configs/sdxl_1_0.yaml"],
  },
  model_mochi: {
    explainFocus: "Mochi video preset: frames and T3K mesh for DiT throughput.",
    whenItFails: "Frame OOM: reduce num_frames in YAML or request.",
    relatedFiles: ["configs/mochi_1.yaml"],
  },
  model_cogvideo: {
    explainFocus: "CogVideoX on multi-chip mesh; resolution and frame budget trade off quality vs memory.",
    whenItFails: "Temporal artifacts: increase steps at cost of latency.",
    relatedFiles: ["configs/cogvideox.yaml"],
  },
  model_qwen_embed: {
    explainFocus: "1024-d embedding preset; max_seq_len gates tokenizer input.",
    whenItFails: "Truncate long docs client-side or raise max in config with memory headroom.",
    relatedFiles: ["configs/qwen_2_5_embed.yaml"],
  },
  util_audio: {
    explainFocus: "ffmpeg-backed decode/resample/chunk—runners see clean WAV-like tensors.",
    whenItFails: "ffmpeg not in PATH or codec unsupported—logs show exit code.",
    relatedFiles: ["utils/audio_manager.py"],
  },
  util_image: {
    explainFocus: "Resize/normalize to runner input; bridges web uploads to model tensors.",
    whenItFails: "EXIF orientation surprises: enable auto-orient in preprocessing if needed.",
    relatedFiles: ["utils/image_manager.py"],
  },
  util_video: {
    explainFocus: "Frames → MP4 for download APIs; temp disk usage can spike on long clips.",
    whenItFails: "ffmpeg mux failure: codec not compiled; disk full.",
    relatedFiles: ["utils/video_manager.py"],
  },
  util_device: {
    explainFocus: "Allocates TT chips via tt-smi semantics; runners assume a valid handle.",
    whenItFails: "No free device: another process holds chips or driver issue.",
    relatedFiles: ["utils/device_manager.py"],
  },
  util_jobmgr: {
    explainFocus: "Tracks async image/video jobs for polling endpoints.",
    whenItFails: "Lost jobs on process restart—in-memory store is not durable.",
    relatedFiles: ["utils/job_manager.py"],
  },
  util_sse: {
    explainFocus: "Formats token streams as SSE for browser clients; pairs with LLMService streaming.",
    whenItFails: "Proxies buffering SSE: disable buffering on nginx for text/event-stream.",
    relatedFiles: ["utils/sse_streamer.py"],
  },
  ttnn: {
    explainFocus: "Python tensor API on TT: most model code touches TTNN ops before Metal.",
    whenItFails: "Tile layout errors: shape not divisible by tile size. SRAM OOM: reduce batch or tensors resident on device.",
    relatedFiles: ["tt-metal/ttnn/README.md", "tt-metal/ttnn/ttnn/"],
  },
  tt_metal: {
    explainFocus: "Low-level device programs, buffers, and kernel launch—TTNN sits on top.",
    whenItFails: "Compile or dispatch errors: arch mismatch, L1 overflow, or sync bugs—often need TT Metal logs.",
    relatedFiles: ["tt-metal/tt_metal/README.md", "tt-metal/tt_metal/api/"],
  },
  dev_active: {
    explainFocus: "Sidebar selection mirrors this node: mesh shape and device ids reflect the profile you’re visualizing (n150 → Galaxy).",
    whenItFails: "Real hardware mismatch: YAML device_ids must fit the machine; tt-smi lists actual chips.",
    relatedFiles: ["hardware/n150", "configs/*.yaml"],
  },
};
