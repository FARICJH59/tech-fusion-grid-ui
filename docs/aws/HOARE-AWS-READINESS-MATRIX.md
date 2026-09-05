# HOARE AWS Partner Readiness Matrix

This matrix separates implemented architecture from AWS-specific validation and commercial readiness.

| Capability | Repository evidence | AWS staging | Partner readiness |
|---|---|---|---|
| HOARE-owned control plane | Sovereign control-plane architecture | verify | ready for solution narrative |
| Provider-neutral infrastructure | Infrastructure adapter registry | verify AWS adapter | ready for architecture narrative |
| Agent/workflow runtime | HOARE runtime/builder surfaces | verify | ready after staging evidence |
| AEGISC security boundary | Builder/security integration work | verify allow/deny | ready after test evidence |
| HOARE authorization | Application-level approval gate | verify | ready after test evidence |
| Tenant isolation | Tenant/runtime architecture | verify | evidence required |
| Audit/evidence | Events and operational surfaces | verify | evidence required |
| Edge/MQTT | Existing edge architecture | later | product narrative only until AWS path is validated |
| AWS deployment | No AWS-specific implementation on main at audit time | build | not yet ready |
| Marketplace listing | not created | n/a | not ready |
| Partner Solution | not created | n/a | not ready |
| Solution Finder | not created | n/a | not ready |
| ACE co-sell | not activated | n/a | not ready |
| FTR | not performed | n/a | future |

## Evidence rule

Only capabilities that pass the AWS staging validation gates should be described as AWS-validated capabilities. Architecture alone must not be presented as deployment proof.

## Commercial packaging target

Primary Solution:

**HOARE Defense Platform**

Candidate associated products/services:

- HOARE Defense Platform software
- AEGISC Security Policy Engine
- HOARE DIB Supply Chain Defense
- HOARE DIB Acceleration
- HOARE Edge Defense Runtime
- HOARE Deployment and Integration Services
- HOARE Managed Defense Operations

These should be introduced progressively rather than creating unnecessary Marketplace listings before the core platform is validated.
