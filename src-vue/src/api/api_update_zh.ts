import ky from 'ky';
import { Ref } from 'vue';
import { UpdateProgress } from './progress';
import { Result, Ok, Err } from './result';
import { BaiduWebTranslator } from '../data/translator/baidu-web';

interface MetadataToTranslateDto {
  title?: string;
  introduction?: string;
  toc: { [key: number]: string };
  episodeIds: string[];
}

interface MetadataTranslatedDto {
  title?: string;
  introduction?: string;
  toc: { [key: number]: string };
}

async function getMetadata(
  providerId: string,
  bookId: string,
  startIndex: number,
  endIndex: number
): Promise<Result<MetadataToTranslateDto, any>> {
  return ky
    .get(`/api/update-zh/metadata/${providerId}/${bookId}`, {
      searchParams: { startIndex, endIndex },
    })
    .json<MetadataToTranslateDto>()
    .then((it) => Ok(it))
    .catch((error) => Err(error));
}

async function postMetadata(
  providerId: string,
  bookId: string,
  translated: MetadataTranslatedDto
): Promise<Result<string, any>> {
  return ky
    .post(`/api/update-zh/metadata/${providerId}/${bookId}`, {
      json: translated,
    })
    .text()
    .then((it) => Ok(it))
    .catch((error) => Err(error));
}

async function getEpisode(
  providerId: string,
  bookId: string,
  episodeId: string
): Promise<string[]> {
  return ky
    .get(`/api/update-zh/episode/${providerId}/${bookId}/${episodeId}`)
    .json<string[]>();
}

async function postEpisode(
  providerId: string,
  bookId: string,
  episodeId: string,
  translated: string[]
): Promise<string> {
  return ky
    .post(`/api/update-zh/episode/${providerId}/${bookId}/${episodeId}`, {
      json: translated,
    })
    .text();
}

function generateQuery(metadata: MetadataToTranslateDto): string[] {
  const query = [];
  if (metadata.title) {
    query.push(metadata.title);
  }
  if (metadata.introduction) {
    query.push(metadata.introduction);
  }
  for (const key in metadata.toc) {
    query.push(metadata.toc[key]);
  }
  return query;
}

function generateTranslated(
  metadata: MetadataToTranslateDto,
  translated: string[]
): MetadataTranslatedDto {
  const obj: MetadataTranslatedDto = { toc: {} };
  if (metadata.title) {
    obj.title = translated.shift();
  }
  if (metadata.introduction) {
    obj.introduction = translated.shift();
  }
  for (const key in metadata.toc) {
    obj.toc[key] = translated.shift()!!;
  }
  return obj;
}

export async function updateZh(
  progress: Ref<UpdateProgress | undefined>,
  providerId: string,
  bookId: string,
  startIndex: number,
  endIndex: number,
  onStart: () => void
): Promise<Result<UpdateProgress, any>> {
  let translator;
  try {
    translator = await BaiduWebTranslator.createInstance('jp', 'zh');
  } catch (e: any) {
    return Err(e);
  }

  const name = '????????????';
  let total = undefined;
  let finished = 0;
  let error = 0;

  progress.value = { name, total, finished, error };

  console.log(`??????????????? ${providerId}/${bookId}`);
  const metadataResult = await getMetadata(
    providerId,
    bookId,
    startIndex,
    endIndex
  );

  if (!metadataResult.ok) {
    return Err(metadataResult.error);
  }

  const metadata = metadataResult.value;
  const metadataQuery = generateQuery(metadata);
  if (metadataQuery.length > 0) {
    console.log(`??????????????? ${providerId}/${bookId}`);
    const metadataTranslated = generateTranslated(
      metadata,
      await translator.translate(metadataQuery)
    );

    console.log(`??????????????? ${providerId}/${bookId}`);
    await postMetadata(providerId, bookId, metadataTranslated);
  }

  total = metadata.episodeIds.length;
  progress.value = { name, total, finished, error };
  onStart();

  for (const episodeId of metadata.episodeIds) {
    try {
      console.log(`???????????? ${providerId}/${bookId}/${episodeId}`);
      const episode = await getEpisode(providerId, bookId, episodeId);

      if (episode.length > 0) {
        console.log(`???????????? ${providerId}/${bookId}/${episodeId}`);
        const episodeTranslated = await translator.translate(episode);

        console.log(`???????????? ${providerId}/${bookId}/${episodeId}`);
        await postEpisode(providerId, bookId, episodeId, episodeTranslated);
      }

      finished += 1;
    } catch (e) {
      error += 1;
    }

    progress.value = { name, total, finished, error };
  }
  return Ok({ name, total, finished, error });
}
