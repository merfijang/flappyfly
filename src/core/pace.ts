/** One simulation step: the brain runs at 50 Hz, as in the original connectome export. */
export const STEP_SECONDS = 0.02;

/**
 * How fast the game runs compared to real time. The fly's signals need ~200 ms to travel from
 * its eyes to the neurons a flap is read from; measured, even a perfect controller with that
 * much lag scores about one pipe at full speed. So the game runs at the fly's pace.
 */
export const GAME_SPEED = 0.5;
