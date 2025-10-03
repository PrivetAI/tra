import React from 'react'
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Mode, Platform, createTask, deleteVideo, getCountries, getTask, sendUnique } from '../api'

type Props = { platform: Platform; onError: (msg: string) => void }
type CountryOption = { code: string | null; name: string }

const DEFAULT_COUNTRY: CountryOption = { code: null, name: 'Глобально' }
const POLL_INTERVAL = Number(import.meta.env.VITE_POLL_INTERVAL_MS || 2000)
const POLL_FAIL_MAX = Number(import.meta.env.VITE_POLL_FAIL_MAX || 1)
const POLL_STALL_MAX = Number(import.meta.env.VITE_POLL_STALL_MAX || 30)
const POLL_TIMEOUT = Number(import.meta.env.VITE_POLL_MAX_MS || 180000)
const clampCount = (value: number) => Math.min(100, Math.max(1, value))

type VideoItem = {
  platformVideoId: string
  title?: string
  author?: string
  previewUrl?: string
  sourceUrl?: string
  status?: string
  views?: number
  likes?: number
  durationSec?: number
  downloadPath?: string
}

type TaskLog = { level: string; message: string; ts: string }

type TaskPayload = {
  mode: Mode
  keywords?: string
  regionName: string
  regionCode: string | null
  count: number
}

const useCountryOptions = () => {
  const [countries, setCountries] = React.useState<CountryOption[]>([DEFAULT_COUNTRY])

  React.useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        const list = await getCountries()
        if (!isMounted) return
        if (Array.isArray(list) && list.length) {
          const filtered = list.filter((item) => item && item.code !== null) as CountryOption[]
          setCountries([DEFAULT_COUNTRY, ...filtered])
        } else {
          setCountries([DEFAULT_COUNTRY])
        }
      } catch {
        if (!isMounted) return
        setCountries([DEFAULT_COUNTRY])
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [])

  return countries
}

const useTaskManager = (platform: Platform, onError: (msg: string) => void) => {
  const [task, setTask] = React.useState<any | null>(null)
  const [videos, setVideos] = React.useState<VideoItem[]>([])
  const [taskErrors, setTaskErrors] = React.useState<string[]>([])
  const [logs, setLogs] = React.useState<TaskLog[]>([])

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const failCountRef = React.useRef(0)
  const stallCountRef = React.useRef(0)
  const lastSnapshotRef = React.useRef('')
  const startTimeRef = React.useRef(0)

  const clearPolling = React.useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const pollTask = React.useCallback(async (taskId: string) => {
    try {
      const data = await getTask(platform, taskId)
      setTask((prev: any) => ({ ...(prev || {}), ...data }))
      setVideos(((data.videos || []) as VideoItem[]))
      setTaskErrors(data.errorMessages || [])
      setLogs(((data.logs || []) as TaskLog[]))

      const readyCount = (data.videos || []).filter((v: any) => v.status === 'ready').length
      const snapshot = JSON.stringify({
        s: data.status,
        d: data.progress?.downloaded,
        t: data.progress?.total,
        r: readyCount,
      })

      if (snapshot === lastSnapshotRef.current) {
        stallCountRef.current += 1
      } else {
        stallCountRef.current = 0
        lastSnapshotRef.current = snapshot
      }

      if (data.status === 'completed' || data.status === 'error') {
        clearPolling()
        if (data.status === 'error' && data.errorMessages?.length) {
          onError(`Задача завершилась с ошибкой: ${data.errorMessages.join(' | ')}`)
        }
      } else if (stallCountRef.current >= POLL_STALL_MAX) {
        clearPolling()
        onError('Нет прогресса по задаче, остановлен поллинг')
      } else if (Date.now() - startTimeRef.current > POLL_TIMEOUT) {
        clearPolling()
        onError('Превышено время ожидания задачи, поллинг остановлен')
      } else {
        failCountRef.current = 0
      }
    } catch (e: any) {
      failCountRef.current += 1
      const message = e?.error?.message || e?.message || 'Ошибка получения статуса'
      onError(message)
      if (failCountRef.current >= POLL_FAIL_MAX) {
        clearPolling()
      }
    }
  }, [platform, onError, clearPolling])

  React.useEffect(() => clearPolling, [clearPolling])

  React.useEffect(() => {
    if (!task?.taskId) return undefined
    const taskId = task.taskId

    clearPolling()

    const execute = () => pollTask(taskId)
    execute()
    startTimeRef.current = Date.now()
    intervalRef.current = setInterval(execute, POLL_INTERVAL)

    return clearPolling
  }, [task?.taskId, pollTask, clearPolling])

  const startTask = React.useCallback(async (payload: TaskPayload) => {
    try {
      clearPolling()
      const data = await createTask(platform, payload as any)
      setTask(data)
      setVideos([])
      setTaskErrors([])
      setLogs([])
      failCountRef.current = 0
      stallCountRef.current = 0
      lastSnapshotRef.current = ''
      startTimeRef.current = Date.now()
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || 'Ошибка создания задачи'
      onError(msg)
    }
  }, [platform, onError, clearPolling])

  const removeVideo = React.useCallback(async (id: string) => {
    let previous: VideoItem[] = []
    setVideos((current) => {
      previous = current
      return current.filter((v) => v.platformVideoId !== id)
    })

    try {
      await deleteVideo(platform, id)
    } catch (e: any) {
      onError('Не удалось удалить')
      setVideos(previous)
    }
  }, [platform, onError])

  const sendUniqueHandler = React.useCallback(async (id: string) => {
    try {
      await sendUnique(platform, id)
    } catch (e: any) {
      onError(e?.error?.message || 'Уникализация недоступна')
    }
  }, [platform, onError])

  return { task, videos, taskErrors, logs, startTask, removeVideo, sendUnique: sendUniqueHandler }
}

export const PlatformColumn: React.FC<Props> = ({ platform, onError }) => {
  const countries = useCountryOptions()
  const [mode, setMode] = React.useState<Mode>('trends')
  const [keywords, setKeywords] = React.useState('')
  const [country, setCountry] = React.useState<string | null>(null)
  const [count, setCount] = React.useState(5)

  const { task, videos, taskErrors, logs, startTask, removeVideo, sendUnique } = useTaskManager(platform, onError)

  const selectedCountry = React.useMemo(
    () => countries.find((item) => item.code === country) ?? DEFAULT_COUNTRY,
    [countries, country],
  )

  const handleSubmit = React.useCallback(() => {
    void startTask({
      mode,
      keywords: mode === 'search' ? keywords.trim() : undefined,
      regionName: selectedCountry.name,
      regionCode: selectedCountry.code,
      count,
    })
  }, [startTask, mode, keywords, selectedCountry, count])

  const handleCountryChange = React.useCallback((event: SelectChangeEvent<string>) => {
    const next = event.target.value
    setCountry(next ? next : null)
  }, [])

  const handleCountChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value)
    setCount((prev) => clampCount(Number.isNaN(next) ? prev : next))
  }, [])

  const handleRemove = React.useCallback((id: string) => {
    void removeVideo(id)
  }, [removeVideo])

  const handleUnique = React.useCallback((id: string) => {
    void sendUnique(id)
  }, [sendUnique])

  const countryValue = country ?? ''

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>{platform.toUpperCase()}</Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button variant={mode==='trends'?'contained':'outlined'} onClick={() => setMode('trends')}>Тренды</Button>
          <Button variant={mode==='search'?'contained':'outlined'} onClick={() => setMode('search')}>Поиск</Button>
        </Stack>
        {mode==='search' && (
          <TextField fullWidth size="small" label="Ключевые слова" value={keywords} onChange={e=>setKeywords(e.target.value)} sx={{ mb: 2 }} />
        )}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Регион</InputLabel>
            <Select value={countryValue} label="Регион" onChange={handleCountryChange}>
              {countries.map((c) => (
                <MenuItem key={String(c.code ?? 'global')} value={c.code ?? ''}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField type="number" size="small" label="Кол-во" value={count} onChange={handleCountChange} inputProps={{ min:1, max:100 }} />
        </Stack>
        <Button variant="contained" onClick={handleSubmit}>Создать задачу</Button>
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle1" gutterBottom>Результаты</Typography>
        {task?.status === 'error' && taskErrors.length > 0 && (
          <Box sx={{ mb: 2, p: 1, border: '1px solid #f44336', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="error">Ошибки задачи</Typography>
            {taskErrors.map((m, i) => (
              <Typography key={i} variant="caption" color="error" sx={{ display: 'block' }}>{m}</Typography>
            ))}
          </Box>
        )}
        {logs.length > 0 && (
          <Box sx={{ mb: 2, p: 1, border: '1px dashed #aaa', borderRadius: 1, maxHeight: 160, overflow: 'auto' }}>
            <Typography variant="subtitle2">Журнал</Typography>
            {logs.map((l, i) => (
              <Typography key={i} variant="caption" color={l.level==='error'?'error':(l.level==='warn'?'warning':'text.secondary')} sx={{ display: 'block' }}>
                [{new Date(l.ts).toLocaleTimeString()}] {l.level.toUpperCase()}: {l.message}
              </Typography>
            ))}
          </Box>
        )}
        <Stack spacing={1}>
          {videos.length === 0 && <Typography color="text.secondary">Нет результатов</Typography>}
          {videos.map((video) => (
            <VideoCard
              key={video.platformVideoId}
              platform={platform}
              video={video}
              onRemove={handleRemove}
              onUnique={handleUnique}
            />
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}

type MetadataRowProps = {
  views?: number
  likes?: number
  durationSec?: number
}

const formatCount = (value?: number) => {
  if (value === undefined) return undefined
  return value.toLocaleString('ru-RU')
}

const formatDuration = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return undefined
  const total = Math.max(0, Math.round(value))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const MetadataRow: React.FC<MetadataRowProps> = ({ views, likes, durationSec }) => {
  const meta: { label: string; value?: string }[] = [
    { label: 'Просмотры', value: formatCount(views) },
    { label: 'Лайки', value: formatCount(likes) },
    { label: 'Длительность', value: formatDuration(durationSec) },
  ].filter((item) => Boolean(item.value))

  if (meta.length === 0) return null

  return (
    <Stack spacing={0.5} sx={{ mt: 1 }}>
      {meta.map((item) => (
        <Typography
          key={item.label}
          variant="caption"
          color="text.secondary"
          sx={{ backgroundColor: '#f5f5f5', borderRadius: 1, px: 0.75, py: 0.25, width: 'fit-content' }}
        >
          {item.label}: {item.value}
        </Typography>
      ))}
    </Stack>
  )
}

type VideoCardProps = {
  platform: Platform
  video: VideoItem
  onRemove: (id: string) => void
  onUnique: (id: string) => void
}

const VideoCard: React.FC<VideoCardProps> = ({ platform, video, onRemove, onUnique }) => {
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080'
  const downloadHref = `${apiBase}/videos/${platform}/${video.platformVideoId}/download`
  const showPreview = Boolean(video.previewUrl)

  const gridTemplateColumns = React.useMemo(() => {
    if (showPreview) {
      return {
        xs: '1fr',
        sm: '220px minmax(220px, 1fr)',
        md: '220px minmax(260px, 1fr) 200px',
      }
    }
    return {
      xs: '1fr',
      sm: 'minmax(220px, 1fr)',
      md: 'minmax(260px, 1fr) 200px',
    }
  }, [showPreview])

  return (
    <Card variant="outlined" sx={{ overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          alignItems: 'start',
          gridTemplateColumns,
        }}
      >
        {showPreview && (
          <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                pt: '177.78%',
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: 'grey.900',
              }}
            >
              <Box
                component="img"
                src={video.previewUrl}
                alt="preview"
                sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </Box>
          </Box>
        )}
        <CardContent
          sx={{
            minWidth: { md: 220 },
            px: 2,
            py: 2,
            gridColumn: { xs: '1 / -1', sm: 'auto' },
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
            {video.title || video.platformVideoId}
          </Typography>
          {video.author && (
            <Typography variant="body2" color="text.secondary">
              {video.author}
            </Typography>
          )}
          <MetadataRow views={video.views} likes={video.likes} durationSec={video.durationSec} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            Статус: {video.status || '—'}
          </Typography>
        </CardContent>
        <CardActions
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 1,
            px: 2,
            py: 2,
            gridColumn: { xs: '1 / -1', sm: '1 / -1', md: 'auto' },
          }}
        >
          {video.sourceUrl && (
            <Button
              size="small"
              variant="outlined"
              fullWidth
              component="a"
              href={video.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Открыть
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            fullWidth
            component={video.downloadPath ? 'a' : 'button'}
            href={video.downloadPath ? downloadHref : undefined}
            disabled={!video.downloadPath}
          >
            Скачать
          </Button>
          <Button size="small" variant="outlined" color="secondary" fullWidth onClick={() => onUnique(video.platformVideoId)}>
            Уникализация
          </Button>
          <Button size="small" variant="outlined" color="error" fullWidth onClick={() => onRemove(video.platformVideoId)}>
            Удалить
          </Button>
        </CardActions>
      </Box>
    </Card>
  )
}
