# HOARE Build Capability Layer — Stage 5

Stage 5 turns repository detection into explicit build capabilities.

C++ is a first-class capability for systems, graphics, physics, game engines, CUDA, embedded, and HPC workloads. AEGISC is a separate first-class HOARE-native capability for workloads supported by the AEGISC compiler/toolchain.

AEGISC does not replace C++. PASOR selects capabilities based on the imported project and requested outcome; a project may use multiple capabilities in one plan.

The capability catalog is provider-neutral. Deployment targets are selected later by the execution/control plane.

Security rule: capability detection is descriptive only. It never executes compiler commands. Compiler execution belongs to governed ExecutionUnits after simulation and authorization.
