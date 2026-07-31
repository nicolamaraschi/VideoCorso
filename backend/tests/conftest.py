"""
pytest configuration for the VideoCorso backend test suite.

Adds the shared Lambda Layer's Python path to sys.path so that tests can
import `shared.purchase_access` without deploying to AWS.
"""

import sys
import pathlib

# The layer content lives at:
#   backend/layers/shared/python/  ← this is what Lambda puts in /opt/python
# We add that directory so `import shared.purchase_access` resolves correctly.
_LAYER_PYTHON = (
    pathlib.Path(__file__).parent.parent
    / "layers" / "shared" / "python"
)
if str(_LAYER_PYTHON) not in sys.path:
    sys.path.insert(0, str(_LAYER_PYTHON))
