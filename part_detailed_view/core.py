"""Surface datasheet links and parameters on the part detail page."""

from __future__ import annotations

from django.utils.translation import gettext_lazy as _

from InvenTree.version import INVENTREE_SW_VERSION
from part.models import Part, PartParameter
from plugin import InvenTreePlugin
from plugin.mixins import SettingsMixin, UserInterfaceMixin

from . import PLUGIN_VERSION


class PartDetailedView(SettingsMixin, UserInterfaceMixin, InvenTreePlugin):
    """Expose datasheet links and parameter tables for parts."""

    NAME = "PartDetailedView"
    SLUG = "part-detailed-view"
    TITLE = _("Part Detailed View")
    DESCRIPTION = _("Show datasheet links and parameters on the part page")
    VERSION = PLUGIN_VERSION
    AUTHOR = "maciek012"
    LICENSE = "MIT"

    SETTINGS = {
        "ENABLE_PART_PANEL": {
            "name": _("Enable Part Panel"),
            "description": _(
                "Display the datasheet and parameter panel for part detail views"
            ),
            "default": True,
            "validator": bool,
        },
        "DATASHEET_COMMENT_KEYWORD": {
            "name": _("Datasheet Comment Keyword"),
            "description": _(
                "Only attachments whose comment contains this value will be treated as datasheets"
            ),
            "default": "datasheet",
        },
        "MAX_PARAMETERS": {
            "name": _("Maximum Parameters"),
            "description": _(
                "Limit how many parameters are forwarded to the UI (0 disables the limit)"
            ),
            "validator": int,
            "default": 25,
        },
    }

    def get_ui_panels(self, request, context: dict | None, **kwargs):
        """Inject a custom panel when viewing a part."""

        if not self.get_setting("ENABLE_PART_PANEL"):
            return []

        context = context or {}
        if context.get("target_model") != "part":
            return []

        target_id = context.get("target_id")
        if not target_id:
            return []

        try:
            part = Part.objects.select_related(None).get(pk=target_id)
        except (Part.DoesNotExist, TypeError, ValueError):
            return []

        panel_context = self._build_panel_context(request, part)

        return [
            {
                "key": "part-detailed-view-panel",
                "title": _("Datasheet & Parameters"),
                "description": _(
                    "Show datasheet links and key parameters for the selected part"
                ),
                "icon": "ti:file-description",
                "source": self.plugin_static_file(
                    "Panel.js:renderPartDetailedViewPanel"
                ),
                "context": panel_context,
            }
        ]

    def _build_panel_context(self, request, part: Part) -> dict:
        """Aggregate context shared with the React panel."""

        keyword = (self.get_setting("DATASHEET_COMMENT_KEYWORD") or "").strip()
        keyword = keyword.lower() or "datasheet"

        datasheets = self._collect_datasheets(request, part, keyword)
        parameters = self._collect_parameters(part)

        return {
            "part": {
                "id": part.pk,
                "name": getattr(part, "full_name", None) or part.name,
                "description": part.description,
                "active": part.active,
                "url": part.get_absolute_url() if hasattr(part, "get_absolute_url") else None,
                "thumbnail": part.get_image_url() if hasattr(part, "get_image_url") else None,
            },
            "datasheets": datasheets,
            "parameters": parameters,
            "meta": {
                "inventree_version": INVENTREE_SW_VERSION,
                "plugin_version": self.VERSION,
            },
        }

    def _collect_datasheets(self, request, part: Part, keyword: str) -> list[dict]:
        """Return attachment records tagged as datasheets."""

        attachments = []
        attachment_manager = getattr(part, "attachments", None)
        if attachment_manager is None:
            return attachments

        qs = attachment_manager.filter(comment__icontains=keyword)
        for attachment in qs.order_by("pk"):
            raw_url = attachment.link or None
            if not raw_url and getattr(attachment, "attachment", None):
                file_field = attachment.attachment
                if file_field and hasattr(file_field, "url"):
                    raw_url = file_field.url

            if not raw_url:
                continue

            if request and not raw_url.startswith(("http://", "https://")):
                raw_url = request.build_absolute_uri(raw_url)

            label = getattr(attachment, "filename", None)
            if callable(label):
                label = label()
            label = label or attachment.comment or "Datasheet"

            attachments.append(
                {
                    "id": attachment.pk,
                    "label": label,
                    "url": raw_url,
                    "comment": attachment.comment,
                }
            )

        return attachments

    def _collect_parameters(self, part: Part) -> list[dict]:
        """Serialize parameter rows for the provided part."""

        parameters = []
        qs = (
            PartParameter.objects.filter(part=part)
            .select_related("template")
            .order_by("template__name", "pk")
        )

        limit = self.get_setting("MAX_PARAMETERS") or 0

        for parameter in qs:
            name = getattr(parameter, "parameter_name", None)
            if not name and parameter.template:
                name = parameter.template.name
            name = name or f"Parameter {parameter.pk}"

            units = parameter.units
            if not units and parameter.template and hasattr(parameter.template, "units"):
                units = parameter.template.units

            parameters.append(
                {
                    "id": parameter.pk,
                    "name": name,
                    "value": parameter.data,
                    "units": units,
                }
            )

            if limit and len(parameters) >= limit:
                break

        return parameters
