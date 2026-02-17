import { prisma } from "../lib/prisma.js";
import type { ArtifactType } from "../generated/prisma/client.js";

export async function addArtifact(
  itemId: string,
  data: { artifactType: ArtifactType; content?: string; filePointer?: string }
) {
  return prisma.artifact.create({
    data: {
      linkedItemId: itemId,
      artifactType: data.artifactType,
      content: data.content ?? null,
      filePointer: data.filePointer ?? null,
    },
  });
}

export async function listArtifactsForItem(itemId: string) {
  return prisma.artifact.findMany({
    where: { linkedItemId: itemId },
    orderBy: { createdAt: "desc" },
  });
}

export async function hasEvidenceForItem(itemId: string): Promise<boolean> {
  const count = await prisma.artifact.count({
    where: {
      linkedItemId: itemId,
      artifactType: { in: ["draft", "email", "decision", "note", "file"] },
      OR: [{ content: { not: null } }, { filePointer: { not: null } }],
    },
  });
  return count > 0;
}
