import sys
import av

sys.stdout.reconfigure(encoding='utf-8')
from faster_whisper import WhisperModel

av_open = av.open

def compatible_open(*args, **kwargs):
    kwargs.pop('metadata_errors', None)
    return av_open(*args, **kwargs)

av.open = compatible_open

audio_path = sys.argv[1]
model_name = sys.argv[2] if len(sys.argv) > 2 else 'base'
model = WhisperModel(model_name, device='cpu', compute_type='int8')
segments, _ = model.transcribe(audio_path, language='ru')
print(' '.join(segment.text.strip() for segment in segments).strip())
