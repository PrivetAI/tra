import { Router } from 'express';
import { listCountriesRu } from '../utils/countries';

export const metaRouter = Router();

metaRouter.get('/countries', (_req, res) => {
  const countries = listCountriesRu();
  res.set('Cache-Control', 'public, max-age=86400');
  res.json({ countries });
});
