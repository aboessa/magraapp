import React from 'react';
import { Composition } from 'remotion';
import { CharacterSheet } from './CharacterSheet';
import { Promo, type PromoProps } from './Promo';
import { FPS, buildTimeline, totalFrames } from './timeline';
import { EgyPromo, egyDuration } from './egy/EgyPromo';

export const Root: React.FC = () => (
  <>
  <Composition id="CharacterSheet" component={CharacterSheet} width={1600} height={1200} fps={FPS} durationInFrames={1} />
  <Composition
    id="MajarraPromo"
    component={Promo}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={totalFrames(buildTimeline(false))}
    defaultProps={{ includeCharacters: false } satisfies PromoProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: totalFrames(buildTimeline(props.includeCharacters, props.cut)),
    })}
  />
  <Composition
    id="MajarraPromo30"
    component={Promo}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={totalFrames(buildTimeline(true, '30'))}
    defaultProps={{ includeCharacters: true, cut: '30' } satisfies PromoProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: totalFrames(buildTimeline(props.includeCharacters, props.cut ?? '30')),
    })}
  />
  {/* Egyptian-dialect 30 s cut: different concept and "pop sticker" style. */}
  <Composition id="MajarraPromoEgy30" component={EgyPromo} width={1080} height={1920} fps={FPS} durationInFrames={egyDuration()} />
  </>
);
