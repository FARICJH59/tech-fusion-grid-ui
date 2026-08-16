# HOARE Project Inventory

The inventory stage runs after a repository is authorized and imported. It creates a tenant-scoped structural inventory for PASOR.

It detects languages, frameworks, package managers, build systems, GitHub Actions, C/C++, AEGISC, and PASOR markers from repository paths/metadata.

It intentionally does **not** ingest source contents in this stage. Source analysis belongs to a later governed execution unit and must remain tenant-scoped.

Flow:

`GitHub authorization -> repository import -> inventory -> PASOR plan -> simulation -> governance -> execution`

Every inventory has a provenance hash so the plan can be tied to the exact observed repository structure.
