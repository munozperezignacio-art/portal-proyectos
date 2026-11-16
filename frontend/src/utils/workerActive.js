export const workerIsActive = worker => String(worker.estado ?? '').trim().toLowerCase() !== 'inactivo';
