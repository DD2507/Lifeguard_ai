from sqlalchemy import Column, Integer, Float, String
from database import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(String, primary_key=True, index=True)
    room = Column(String, nullable=False)
    heart_rate = Column(Integer, nullable=False)
    spo2 = Column(Integer, nullable=False)
    temperature = Column(Float, nullable=False)
    risk = Column(String, nullable=False)