import json
import logging
import os
from typing import Any, Dict, Optional

try:
    from openai import OpenAI  # type: ignore
except ImportError:  # pragma: no cover - optional dependency
    OpenAI = None  # type: ignore

logger = logging.getLogger(__name__)


class AIDesignAssistantError(RuntimeError):
    """Raised when the AI enrichment workflow cannot be executed."""


class AIDesignAssistant:
    """Helper around OpenAI GPT models to enrich architectural data."""

    def __init__(self) -> None:
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise AIDesignAssistantError('OPENAI_API_KEY env var not set')
        if OpenAI is None:
            raise AIDesignAssistantError('openai package not installed. Run `pip install openai`.')

        self.client = OpenAI(api_key=api_key)
        requested_model = os.getenv('OPENAI_MODEL', '').strip() or 'gpt-5-mini'
        normalized = requested_model.lower()
        cheap_models = {
            'gpt-5-mini',
            'gpt-5-mini-2024-12-17',
            'gpt-5-mini-latest',
        }
        allow_expensive = os.getenv('OPENAI_ALLOW_EXPENSIVE', '').lower() in {'1', 'true', 'yes'}

        if normalized not in cheap_models:
            if not allow_expensive:
                logger.info('Overriding model %s with cost-optimised gpt-5-mini', requested_model)
                requested_model = 'gpt-5-mini'
            else:
                logger.warning('Using non-cheap OpenAI model %s (ALLOW_EXPENSIVE enabled)', requested_model)

        # Additional fallback mapping for legacy aliases
        if requested_model.lower() in {'gpt-4o', 'gpt-5'}:
            logger.info('Downgrading legacy model %s to gpt-5-mini for cost control', requested_model)
            requested_model = 'gpt-5-mini'

        self.model = requested_model
        self.temperature = float(os.getenv('OPENAI_TEMPERATURE', '0.1'))
        self.max_tokens = int(os.getenv('OPENAI_MAX_OUTPUT_TOKENS', '900'))

    def analyze_floorplan(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Request AI suggestions for rooms, materials, cameras and notes.

        The payload should minimally contain `elements` (list) and optionally
        metadata such as `file_info`, `statistics`, and `unit_system`.
        """
        system_prompt = (
            "You are an architectural assistant that converts parsed CAD/IFC "
            "data into a structured JSON plan for enriching 3D interiors. "
            "Return valid JSON matching the following keys: rooms (list), "
            "materials (list), cameras (list), assumptions (string)."
        )

        guidance = (
            "Expect `elements` with wall/space/floor/door/window entries. "
            "Use that to infer full room coverage (floors & ceilings), "
            "default material categories (flooring, wall paint, ceiling finish, "
            "trim, furniture) and sensible indoor camera viewpoints (position "
            "and look_at vectors in meters). Return:")

        response_format_hint = (
            '{"rooms": [{"id": "space_1", "type": "living_room", "default_materials": '
            '{"floor": "wood_plank", "ceiling": "matte_white", "walls": "neutral_paint"}, '
            '"notes": "Open concept facing south"}], "materials": ['
            '{"element_match": "wall", "category": "wall_paint", "suggestion": "matte_white"}], '
            '"cameras": [{"name": "living_room_entry", "position": [2.5, 1.6, -3.0], '
            '"look_at": [0.0, 1.4, 0.0]}], "assumptions": "Ceiling height 2.7m"}'
        )

        user_prompt = (
            f"Input context (JSON):\n{json.dumps(payload, default=str)[:12000]}\n\n"
            f"{guidance}\n{response_format_hint}\nReturn only JSON."
        )

        completion = self.client.chat.completions.create(
            model=self.model,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            response_format={'type': 'json_object'},
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt},
            ],
        )

        content = completion.choices[0].message.content or '{}'
        try:
            return json.loads(content)
        except json.JSONDecodeError as exc:
            logger.warning('AI response was not valid JSON: %s', exc)
            return {'error': 'invalid_json', 'raw': content}


def build_assistant() -> Optional[AIDesignAssistant]:
    try:
        return AIDesignAssistant()
    except Exception as exc:  # pragma: no cover - best effort instantiation
        logger.warning('AI assistant disabled: %s', exc)
        return None
