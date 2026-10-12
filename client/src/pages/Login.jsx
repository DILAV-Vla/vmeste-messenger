import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.error || 'Неверные данные');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center text-4xl shadow-2xl">
            💬
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Вместе</h1>
          <p className="text-teal-300 text-sm italic">Хорошие люди — лучшие чаты</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800/60 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/50 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6">Войти</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm p-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <label className="block text-slate-400 text-xs mb-1 ml-1">Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full p-3 mb-4 bg-slate-900/60 border border-slate-700 rounded-xl text-white outline-none focus:border-teal-400 transition"
            onChange={e => setEmail(e.target.value)}
            required
          />

          <label className="block text-slate-400 text-xs mb-1 ml-1">Пароль</label>
          <input
            type="password"
            placeholder="••••••••"
            className="w-full p-3 mb-6 bg-slate-900/60 border border-slate-700 rounded-xl text-white outline-none focus:border-teal-400 transition"
            onChange={e => setPassword(e.target.value)}
            required
          />

          <button className="w-full bg-gradient-to-r from-teal-400 to-blue-500 text-white font-semibold p-3 rounded-xl hover:opacity-90 transition shadow-lg">
            Войти
          </button>

          <Link to="/register" className="block mt-4 text-center text-sm text-teal-300 hover:text-teal-200">
            Нет аккаунта? Создать
          </Link>
        </form>
      </div>
    </div>
  );
}