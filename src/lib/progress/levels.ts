// Team progress level descriptions (decision 0030, project doc "Firstpass U7 progress level descriptions").
// One line per level per attribute per age group, written for coaches: something you can see on the
// ice in a few seconds. A skater is at the highest level they reach most of the time. Levels are
// relative to the age group. A team sees Progress only once its age group has a set here.

import { FOCUS_ATTRIBUTES } from '../drills/schema';

export type Attribute = (typeof FOCUS_ATTRIBUTES)[number];
export const ATTRIBUTES = FOCUS_ATTRIBUTES;
export const LEVELS = [1, 2, 3, 4, 5] as const;

export type LevelSet = { ageGroup: string; version: string; levels: Record<Attribute, readonly [string, string, string, string, string]> };

const U7: LevelSet = {
  ageGroup: 'U7',
  version: 'U7-2026-11-15',
  levels: {
    Skating: [
      'Needs help to stand up or glide, and falls often',
      'Gets up alone, marches forward and glides on two feet',
      'Glides on one foot, stops one way (a snowplow counts), turns both ways slowly',
      'Hockey stops both ways, starting crossovers, a few strides backward',
      'Ahead of U7: crossovers both ways, skates backward with C-cuts, quick starts',
    ],
    'Puck control': [
      'Stick is often off the ice; touches the puck now and then',
      'Pushes the puck ahead while skating slowly, loses it often',
      'Stickhandles standing still; carries the puck at a steady skate, eyes on the puck',
      'Stickhandles while moving and can turn with the puck, sometimes looks up',
      'Ahead of U7: carries the puck at speed, head up, can get around someone',
    ],
    Passing: [
      'Not passing yet: hits the puck anywhere',
      'Pushes the puck to a partner standing close; sometimes stops a pass',
      'Passes to a standing partner a few sticks away; stops most passes with the stick',
      'Passes and receives while moving slowly, in a drill',
      'Ahead of U7: passes to a moving teammate, and looks to pass in games',
    ],
    Shooting: [
      'Swings at the puck; it rarely goes toward the net',
      'Pushes the puck at the net from close, standing still',
      'Shoots from a stop with a sweep and reaches the net from the dots',
      'Shoots while moving; sometimes lifts it off the ice',
      'Ahead of U7: lifts it most times, shoots in stride, aims for a spot',
    ],
    'Game sense': [
      'Watches or wanders in games; not sure where the puck or the net is',
      'Chases the puck with everyone; knows which net to shoot at',
      'Goes for the puck, tries to score, stops on the whistle',
      'Sometimes moves to open ice or helps a teammate; chases back when the other team has it',
      'Ahead of U7: reads where the puck is going and passes to an open teammate',
    ],
    'Effort & fun': [
      'Often doesn’t want to join in; needs a coach or parent close by',
      'Joins in with encouragement; stops when it gets hard or after a fall',
      'Joins most drills, gets back up and keeps going, smiles at some point',
      'Keen for every drill, tries hard things again, cheers teammates on',
      'Ahead of U7: keeps going when tired, first in line, helps others join in',
    ],
  },
};

const SETS: LevelSet[] = [U7];

/** The level set for a team's age group, or null: that team doesn't see Progress yet. */
export function levelSetFor(ageGroup: string): LevelSet | null {
  return SETS.find((s) => s.ageGroup === ageGroup) ?? null;
}

/** A set by its version string, for reports scored against an older set. Falls back to the current one. */
export function levelSetByVersion(version: string, ageGroup: string): LevelSet | null {
  return SETS.find((s) => s.version === version) ?? levelSetFor(ageGroup);
}
