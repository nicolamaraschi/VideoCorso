import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, CheckCircle, Clock, Award } from 'lucide-react';
import { Button } from '../components/common/Button';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Play,
      title: 'High-Quality Video Lessons',
      description: 'Professional video content organized in easy-to-follow chapters',
    },
    {
      icon: CheckCircle,
      title: 'Track Your Progress',
      description: 'Automatic progress tracking and lesson completion markers',
    },
    {
      icon: Clock,
      title: 'Learn at Your Own Pace',
      description: 'Access the course anytime, anywhere, on any device',
    },
    {
      icon: Award,
      title: 'Expert Instruction',
      description: 'Learn from industry experts with years of experience',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Master New Skills with
            <span className="text-primary-600"> VideoCorso</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Access our comprehensive video course and learn at your own pace.
            Professional content, progress tracking, and lifetime access.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/checkout')}
            >
              Get Started Now
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate('/login')}
            >
              Sign In
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Why Choose VideoCorso?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Start Learning?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join thousands of students already mastering new skills
          </p>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate('/checkout')}
          >
            Enroll Today
          </Button>
        </div>
      </div>
    </div>
  );
};
