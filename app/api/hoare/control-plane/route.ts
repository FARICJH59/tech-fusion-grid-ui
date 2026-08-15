import { NextResponse } from 'next/server';
import {
  createApplication,
  createTenant,
  listControlPlaneResources,
} from '@/lib/hoare/control-plane/routes';
import type { IsolationLevel } from '@/lib/hoare/control-plane/types';

export async function GET() {
  return NextResponse.json({
    ok: true,
    controlPlane: 'hoare',
    resources: listControlPlaneResources(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.kind === 'tenant') {
      if (!body.organizationId || !body.name || !body.region) {
        return NextResponse.json({ error: 'organizationId, name, and region are required' }, { status: 400 });
      }

      return NextResponse.json(
        createTenant({
          organizationId: body.organizationId,
          name: body.name,
          region: body.region,
          isolation: (body.isolation ?? 'shared') as IsolationLevel,
        }),
        { status: 201 },
      );
    }

    if (body.kind === 'application') {
      if (!body.tenantId || !body.name || !body.runtime) {
        return NextResponse.json({ error: 'tenantId, name, and runtime are required' }, { status: 400 });
      }

      return NextResponse.json(
        createApplication({
          tenantId: body.tenantId,
          name: body.name,
          runtime: body.runtime,
          domain: body.domain,
        }),
        { status: 201 },
      );
    }

    return NextResponse.json({ error: 'Unsupported resource kind' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 });
  }
}
